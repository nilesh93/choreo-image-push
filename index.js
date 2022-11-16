const core = require('@actions/core');
const github = require('@actions/github');
const io = require("@actions/io");
const { spawn } = require("child_process");

try {
  const choreoApp = process.env.CHOREO_GITOPS_REPO;
  const fileContents = fs.readFileSync(`/home/runner/workspace/${choreoApp}/registry-credentials.json`, 'utf8');
  let data = JSON.parse(fileContents);
  for (const cred of data) {
    if (cred.type == 'ACR') {
      let username = cred.credentials.registryUser;
      let password = cred.credentials.registryPassword;
      let loginServer = cred.credentials.registry;
      let authenticationToken = Buffer.from(`${username}:${password}`).toString('base64');
      let config;
      const runnerTempDirectory = process.env['RUNNER_TEMP']; // Using process.env until the core libs are updated
      const dirPath = process.env['DOCKER_CONFIG'] || path.join(runnerTempDirectory, `docker_login_${Date.now()}`);
      yield io.mkdirP(dirPath);
      const dockerConfigPath = path.join(dirPath, `config.json`);
      if (fs.existsSync(dockerConfigPath)) {
        try {
          config = JSON.parse(fs.readFileSync(dockerConfigPath, 'utf8'));
          if (!config.auths) {
            config.auths = {};
          }
          config.auths[loginServer] = { auth: authenticationToken };
        }
        catch (err) {
          // if the file is invalid, just overwrite it
          config = undefined;
        }
      }
      if (!config) {
        config = {
          "auths": {
            [loginServer]: {
              auth: authenticationToken
            }
          }
        };
      }
      core.debug(`Writing docker config contents to ${dockerConfigPath}`);
      fs.writeFileSync(dockerConfigPath, JSON.stringify(config));
      core.exportVariable('DOCKER_CONFIG', dirPath);
      console.log('DOCKER_CONFIG environment variable is set');
    };
  }
  const tempImage = process.env.DOCKER_TEMP_IMAGE;
  const newImageTag = `${cred.credentials.registry}`;
  var child = spawn(`docker image tag ${tempImage} ${newImageTag} && dcoker push ${newImageTag}`, {
    shell: true
  });
  child.stderr.on('data', function (data) {
    console.error("STDERR:", data.toString());
  });
  child.stdout.on('data', function (data) {
    console.log("STDOUT:", data.toString());
  });
  child.on('exit', function (exitCode) {
    console.log("Child exited with code: " + exitCode);
  });
} catch (error) {
  core.setFailed(error.message);
}