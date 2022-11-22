const io = require("@actions/io");
const { spawn } = require("child_process");
const fs = require('fs');
const path = require('path');

async function dockerPush() {
    // try {
    const tempImage = '';
    const newImageTag = '';
    // Pushing images to Registory
    var child = spawn(`docker image tag ${tempImage} ${newImageTag} && docker push ${newImageTag}`, {
        shell: true
    });
   
    var data = "";
    for await (const chunk of child.stdout) {
        console.log('stdout chunk: ' + chunk);
        data += chunk;
    }
    var error = "";
    for await (const chunk of child.stderr) {
        console.error('stderr chunk: ' + chunk);
        error += chunk;
    }
    const exitCode = await new Promise((resolve, reject) => {
        child.on('close', resolve);
    });

    if (exitCode) {
        throw new Error(`subprocess error exit ${exitCode}, ${error}`);
    }
    return data;
}

async function run() {
    let images = ["1", "2"]
    for (const iterator of images) {
       await dockerPush();
    }
}

run().catch((e) => console.log(e));