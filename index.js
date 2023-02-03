const core = require("@actions/core");
const io = require("@actions/io");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const choreoApp = process.env.CHOREO_GITOPS_REPO;

async function run() {
  try {
    const fileContents = fs.readFileSync(
      `/home/runner/workspace/${choreoApp}/${process.env.REG_CRED_FILE_NAME}`,
      "utf8"
    );
    let data = JSON.parse(fileContents);
    for (const cred of data) {
      if (cred.type == "ACR") {
        await acrLogin(cred);
        await dockerPush(cred);
      }
      if (cred.type == "ECR") {
        await ecrLoginPrivate(cred);
        await dockerPush(cred);
      }
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

async function ecrLoginPrivate(cred) {
  const username = cred.credentials.registryUser;
  const password = cred.credentials.registryPassword;
  const region = cred.credentials.region;
  const registry = cred.credentials.registry;

  var child = spawn(
    `aws configure set aws_access_key_id ${username} && aws configure set aws_secret_access_key ${password} && aws configure set default.region ${region} && aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin ${registry} && aws ecr describe-repositories --repository-names ${choreoApp} || aws ecr create-repository --image-scanning-configuration scanOnPush=true --repository-name ${choreoApp}`,
    {
      shell: true,
    }
  );
  var data = "";
  for await (const chunk of child.stdout) {
    console.log("stdout chunk: " + chunk);
    data += chunk;
  }
  var error = "";
  for await (const chunk of child.stderr) {
    console.error("stderr chunk: " + chunk);
    error += chunk;
  }
  const exitCode = await new Promise((resolve, reject) => {
    child.on("close", resolve);
  });

  if (exitCode) {
    throw new Error(`subprocess error exit ${exitCode}, ${error}`);
  }
  return data;
}

// Deprecated: Please implment this feature
async function ecrLoginPublic(cred) {
  const username = cred.credentials.registryUser;
  const password = cred.credentials.registryPassword;
  const region = cred.credentials.region;

  var child = spawn(
    `aws configure set aws_access_key_id ${username} && aws configure set aws_secret_access_key ${password} && aws configure set default.region ${region} && aws ecr-public get-login-password --region ${region} | docker login --username AWS --password-stdin public.ecr.aws && aws ecr-public describe-repositories --repository-names ${choreoApp} || aws ecr-public create-repository --repository-name ${choreoApp}`,
    {
      shell: true,
    }
  );
  var data = "";
  for await (const chunk of child.stdout) {
    console.log("stdout chunk: " + chunk);
    data += chunk;
  }
  var error = "";
  for await (const chunk of child.stderr) {
    console.error("stderr chunk: " + chunk);
    error += chunk;
  }
  const exitCode = await new Promise((resolve, reject) => {
    child.on("close", resolve);
  });

  if (exitCode) {
    throw new Error(`subprocess error exit ${exitCode}, ${error}`);
  }
  return data;
}

async function acrLogin(cred) {
  try {
    const username = cred.credentials.registryUser;
    const password = cred.credentials.registryPassword;
    const loginServer = cred.credentials.registry;
    const authenticationToken = Buffer.from(`${username}:${password}`).toString(
      "base64"
    );
    let config;
    const runnerTempDirectory = process.env["RUNNER_TEMP"]; // Using process.env until the core libs are updated
    const dirPath =
      process.env["DOCKER_CONFIG"] ||
      path.join(runnerTempDirectory, `docker_login_${Date.now()}`);
    await io.mkdirP(dirPath);
    const dockerConfigPath = path.join(dirPath, `config.json`);
    if (fs.existsSync(dockerConfigPath)) {
      try {
        config = JSON.parse(fs.readFileSync(dockerConfigPath, "utf8"));
        if (!config.auths) {
          config.auths = {};
        }
        config.auths[loginServer] = { auth: authenticationToken };
      } catch (err) {
        // if the file is invalid, just overwrite it
        config = undefined;
      }
    }
    if (!config) {
      config = {
        auths: {
          [loginServer]: {
            auth: authenticationToken,
          },
        },
      };
    }
    core.debug(`Writing docker config contents to ${dockerConfigPath}`);
    fs.writeFileSync(dockerConfigPath, JSON.stringify(config));
    core.exportVariable("DOCKER_CONFIG", dirPath);
    console.log("DOCKER_CONFIG environment variable is set");
  } catch (error) {
    core.setFailed(error);
  }
}

async function dockerPush(cred) {
  const tempImage = process.env.DOCKER_TEMP_IMAGE;
  const newImageTag = `${cred.credentials.registry}/${choreoApp}:${process.env.NEW_SHA}`;
  // Pushing images to Registory
  var child = spawn(
    `docker image tag ${tempImage} ${newImageTag} && docker push ${newImageTag}`,
    {
      shell: true,
    }
  );
  var data = "";
  for await (const chunk of child.stdout) {
    console.log("stdout chunk: " + chunk);
    data += chunk;
  }
  var error = "";
  for await (const chunk of child.stderr) {
    console.error("stderr chunk: " + chunk);
    error += chunk;
  }
  const exitCode = await new Promise((resolve, reject) => {
    child.on("close", resolve);
  });

  if (exitCode) {
    throw new Error(`subprocess error exit ${exitCode}, ${error}`);
  }
  return data;
}

run().catch(core.setFailed);
