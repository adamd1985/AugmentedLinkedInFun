const tf = require("@tensorflow/tfjs");
const tfn = require("@tensorflow/tfjs-node");
const use = require('@tensorflow-models/universal-sentence-encoder');

const handler = tfn.io.fileSystem('./notebooks/models/tfjs/model.json');

async function testModel(){
    const model = await tf.loadLayersModel(handler);

    const useModel = await use.load();
    const embeddings = await useModel.embed(["IT Consultant at Sesame Street, lord of Java Code, who likes to learn new stuff and tries some machine learning in my free engineering time."])

    const t = await model.predict(embeddings);

    // {'bigbird': 0, 'count': 1, 'grover': 2, 'grouch': 3, 'erniebert': 4}
    // [0.00236707 0.00669724 0.9246539  0.06278326 0.00349861]
    const predictions = t.dataSync();
    console.log(`Prediction from JS vs PY: \nJS - ${predictions}\nPY - 0.00236707, 0.00669724, 0.9246539, 0.06278326, 0.00349861`);

    const LABELS = ["bigbird", "count", "grover", "grouch", "erniebert"];
    const indexOfMaxValue = predictions.reduce((iMax, x, i, arr) => x > arr[iMax] ? i : iMax, 0);   

    console.log(`Character is: ${LABELS[indexOfMaxValue]}`);
}

testModel();

