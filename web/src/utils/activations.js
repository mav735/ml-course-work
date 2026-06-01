import * as tf from '@tensorflow/tfjs';
import { normalizeMap } from './colormap.js';

/**
 * Discover all Conv2D layers in the model, in forward order.
 * Used by every visualization tab so user-edited architectures keep working.
 */
export function findConvLayerNames(model) {
  const names = [];
  for (const layer of model.layers) {
    const cls = (layer.getClassName?.() || '').toLowerCase();
    const name = (layer.name || '').toLowerCase();
    if (cls === 'conv2d' || name.startsWith('conv')) {
      names.push(layer.name);
    }
  }
  return names;
}

/**
 * Build a multi-output model that returns activations from every conv layer
 * and every spatial pooling layer (max/avg pool).
 */
export function buildActivationModel(model) {
  const layerNames = [];
  for (const layer of model.layers) {
    const cls = (layer.getClassName?.() || '').toLowerCase();
    const name = (layer.name || '').toLowerCase();
    const isConv = cls === 'conv2d' || (cls === '' && name.startsWith('conv'));
    const isSpatialPool =
      cls === 'maxpooling2d' ||
      cls === 'averagepooling2d' ||
      (cls === '' && (name.startsWith('pool') || name.startsWith('maxpool') || name.startsWith('avgpool')));
    if (!(isConv || isSpatialPool)) continue;

    const out = layer.output;
    const rank = Array.isArray(out?.shape) ? out.shape.length : 0;
    if (rank !== 4) continue;

    layerNames.push(layer.name);
  }

  if (layerNames.length === 0) return null;

  const outputs = layerNames.map((n) => model.getLayer(n).output);
  return {
    model: tf.model({ inputs: model.inputs, outputs }),
    layerNames,
  };
}

/**
 * Extract activations for a single image tensor [1, 64, 64, 1].
 * Returns an array of { name, meanMap, maxMap, H, W } objects.
 */
export async function extractActivations(activationModel, layerNames, inputTensor) {
  const results = [];

  const rawOutputs = activationModel.predict(inputTensor);
  const outputs = Array.isArray(rawOutputs) ? rawOutputs : [rawOutputs];

  for (let i = 0; i < layerNames.length; i++) {
    const act = outputs[i]; // [1, H, W, C]
    const [, H, W] = act.shape;

    const meanTensor = act.mean(-1).squeeze([0]);
    const maxTensor = act.max(-1).squeeze([0]);

    const meanData = normalizeMap(await meanTensor.data());
    const maxData = normalizeMap(await maxTensor.data());

    meanTensor.dispose();
    maxTensor.dispose();

    results.push({ name: layerNames[i], meanMap: meanData, maxMap: maxData, H, W });
  }

  outputs.forEach((t) => t.dispose());

  return results;
}

/**
 * Top-K channel maps from the second-to-last conv layer (mid-level features).
 * Channels are scored by mean activation over the entire image.
 *
 * Returns { channelsA, channelsB, layerName } each channels array being
 * { channelIdx, mapData, H, W }.
 */
export async function extractTopKChannels(model, tensorA, tensorB, K = 6) {
  const convNames = findConvLayerNames(model);
  if (convNames.length < 1) return null;

  const targetName = convNames[Math.max(0, convNames.length - 2)];

  const targetOutput = model.getLayer(targetName).output;
  const targetModel = tf.model({ inputs: model.inputs, outputs: targetOutput });

  async function getTopK(inputTensor) {
    const act = targetModel.predict(inputTensor); // [1, H, W, C]
    const [, H, W, C] = act.shape;

    const scores = act.mean([0, 1, 2]); // [C] — whole-image mean per channel
    const k = Math.min(K, C);
    const { values: topVals, indices: topIdx } = tf.topk(scores, k);
    const idxArr = Array.from(await topIdx.data());

    topVals.dispose();
    topIdx.dispose();
    scores.dispose();

    const channels = await Promise.all(
      idxArr.map(async (chIdx) => {
        const chSlice = act.slice([0, 0, 0, chIdx], [1, H, W, 1]).squeeze([0, 3]);
        const rawData = await chSlice.data();
        chSlice.dispose();
        return { channelIdx: chIdx, mapData: normalizeMap(rawData), H, W };
      })
    );

    act.dispose();
    return channels;
  }

  const channelsA = await getTopK(tensorA);
  const channelsB = await getTopK(tensorB);

  return { channelsA, channelsB, layerName: targetName };
}
