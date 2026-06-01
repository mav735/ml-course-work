import * as tf from '@tensorflow/tfjs';
import { normalizeMap, bilinearResize } from './colormap.js';
import { findConvLayerNames } from './activations.js';

let _gradcamVarCounter = 0;

/**
 * Compute Grad-CAM hooked at the LAST conv layer of the model. Works with
 * any architecture the user assembles — no hardcoded layer names.
 *
 * inputTensor: [1, 64, 64, 1]
 * classIdx:    output class index
 * Returns { cam: Float32Array [64, 64] normalized [0,1], camH, camW, layerName }
 */
export async function computeGradCAM(model, inputTensor, classIdx) {
  const convNames = findConvLayerNames(model);
  if (convNames.length === 0) return null;
  const targetName = convNames[convNames.length - 1];

  const targetLayer = model.getLayer(targetName);
  const convExtractor = tf.model({ inputs: model.inputs, outputs: targetLayer.output });

  const convActivations = convExtractor.predict(inputTensor);
  const [, camH, camW] = convActivations.shape;

  const targetIdx = model.layers.findIndex((l) => l.name === targetName);
  const layersAfterTarget = model.layers.slice(targetIdx + 1);

  // Create a tf.Variable for gradient tracking — use a unique name
  const varName = `gradcam_var_${_gradcamVarCounter++}`;
  const convVar = tf.variable(convActivations, true, varName);

  // Compute gradients w.r.t. convVar
  const { grads } = tf.variableGrads(() => {
    let x = convVar;
    for (const layer of layersAfterTarget) {
      x = layer.apply(x);
    }
    return x.slice([0, classIdx], [1, 1]).reshape([]);
  }, [convVar]);

  const gradTensor = grads[varName]; // [1, H, W, C]

  const pooledGrads = gradTensor.mean([0, 1, 2]);

  // Weight activations by pooled gradients
  const actSqueezed = convActivations.squeeze([0]); // [H, W, C]
  const weighted = actSqueezed.mul(pooledGrads);    // [H, W, C]
  const camRaw = weighted.sum(-1).relu();           // [H, W]

  const camData = await camRaw.data();

  camRaw.dispose();
  weighted.dispose();
  actSqueezed.dispose();
  pooledGrads.dispose();
  gradTensor.dispose();
  convVar.dispose();
  convActivations.dispose();

  // Normalize to [0, 1]
  const normCam = normalizeMap(camData);

  // resize from [camH, camW] to [64, 64]
  const resized = bilinearResize(normCam, camH, camW, 64, 64);

  return { cam: resized, camH, camW, layerName: targetName };
}
