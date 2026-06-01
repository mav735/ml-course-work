import * as tf from '@tensorflow/tfjs';

export const DEFAULT_LAYERS = [
  { type: 'conv', name: 'conv1', filters: 16, kernelSize: 3 },
  { type: 'conv', name: 'conv2', filters: 24, kernelSize: 3 },
  { type: 'pool', name: 'pool1', poolType: 'max' },
  { type: 'conv', name: 'conv3', filters: 32, kernelSize: 3 },
  { type: 'pool', name: 'pool2', poolType: 'max' },
  { type: 'conv', name: 'conv4', filters: 16, kernelSize: 3 },
];

/**
 * Build a TF.js model from a layer config array.
 * Input: [batch, 64, 64, 1]
 * Output: [batch, 2] (classA vs classB softmax)
 */
export function buildModel(layerConfig) {
  const input = tf.input({ shape: [64, 64, 1], name: 'input' });
  let x = input;

  for (const layerDef of layerConfig) {
    if (layerDef.type === 'conv') {
      x = tf.layers
        .conv2d({
          filters: layerDef.filters,
          kernelSize: layerDef.kernelSize || 3,
          padding: 'same',
          activation: 'relu',
          name: layerDef.name,
        })
        .apply(x);
    } else if (layerDef.type === 'pool') {
      const poolCtor =
        layerDef.poolType === 'avg'
          ? tf.layers.averagePooling2d
          : tf.layers.maxPooling2d;
      x = poolCtor({ poolSize: [2, 2], strides: [2, 2], name: layerDef.name }).apply(x);
    }
  }

  x = tf.layers.globalAveragePooling2d({ name: 'gap' }).apply(x);
  x = tf.layers.dense({ units: 2, activation: 'softmax', name: 'output' }).apply(x);

  return tf.model({ inputs: input, outputs: x, name: 'SmallCNN' });
}

/**
 * Count total trainable parameters.
 */
export function countParams(model) {
  return model.trainableWeights.reduce((sum, w) => sum + w.shape.reduce((a, b) => a * b, 1), 0);
}

/**
 * Train the model.
 * onEpochEnd: async (epoch, logs, history) => void
 */
export async function trainModel(model, pixels, labels, N, config, onEpochEnd) {
  const { lr, epochs, batchSize } = config;

  model.compile({
    optimizer: tf.train.adam(lr),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });

  const xs = tf.tensor4d(pixels, [N, 64, 64, 1]);
  const ys = tf.oneHot(tf.tensor1d(Array.from(labels), 'int32'), 2).cast('float32');

  const history = [];

  try {
    await model.fit(xs, ys, {
      epochs,
      batchSize,
      validationSplit: 0.2,
      shuffle: true,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          const entry = {
            epoch: epoch + 1,
            loss: logs.loss,
            acc: logs.acc,
            valLoss: logs.val_loss,
            valAcc: logs.val_acc,
          };
          history.push(entry);
          await onEpochEnd(epoch, logs, [...history]);
          await tf.nextFrame();
        },
      },
    });
  } finally {
    xs.dispose();
    ys.dispose();
  }

  return history;
}
