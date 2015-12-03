'use strict';

let spawn = require('cross-spawn-async'),
  Promise = require('bluebird'),
  log = require('intel'),
  merge = require('lodash.merge');

const defaults = {
  'java': 'java',
  'stdoutLogLevel': log.INFO,
  'stderrLogLevel': log.ERROR,
  'startupCriteria': {
    'success': {
      'stdout': null,
      'stderr': null
    },
    'failure': {
      'stdout': null,
      'stderr': null
    }
  }
};

function launchJar(java, jarPath, args) {
  args = ['-jar', jarPath].concat(args || []);

  log.debug('launching java process with args: %j', args);

  // FIXME should promisify spawn, see https://github.com/petkaantonov/bluebird/blob/master/API.md#option-filter
  return spawn(java, args);
}

function addLogListener(stream, level) {
  stream.on('data', function(data) {
    log.log(level, data.toString());
  });
}

function setupProcessLogging(process, options) {
  if (log.isEnabledFor(options.stdoutLogLevel)) {
    addLogListener(process.stdout, options.stdoutLogLevel);
  }
  if (log.isEnabledFor(options.stderrLogLevel)) {
    addLogListener(process.stderr, options.stderrLogLevel);
  }
}

function hasStartupCriteria(startupCriteria, streamName) {
  let success = startupCriteria.success,
    failure = startupCriteria.failure;
  return success[streamName] || failure[streamName];
}

function getStartupCriteriaListener(startupCriteria, streamName, resolve, reject) {
  let success = startupCriteria.success[streamName];
  let failure = startupCriteria.failure[streamName];

  return function(data) {
    const logLine = data.toString();
    if (logLine.match(success)) {
      return resolve();
    } else if (logLine.match(failure)) {
      return reject(new Error('Process logged: ' + logLine));
    }
  }
}

class JarLauncher {
  constructor(options) {
    this.options = merge({}, defaults, options);
    if (!this.options.jarPath) {
      throw new Error('jarPath must be set!');
    }
  }

  start(args) {
    this.javaProcess = launchJar(this.options.java, this.options.jarPath, args);

    setupProcessLogging(this.javaProcess, this.options);

    let startupCriteria = this.options.startupCriteria;

    if (hasStartupCriteria(startupCriteria, 'stdout') || hasStartupCriteria(startupCriteria, 'stderr')) {
      let javaProcess = this.javaProcess;

      return new Promise(function(resolve, reject) {
        if (hasStartupCriteria(startupCriteria, 'stdout')) {
          javaProcess.stdout.on('data', getStartupCriteriaListener(startupCriteria, 'stdout', resolve, reject));
        }
        if (hasStartupCriteria(startupCriteria, 'stderr')) {
          javaProcess.stderr.on('data', getStartupCriteriaListener(startupCriteria, 'stderr', resolve, reject));
        }

        javaProcess.on('close', function (code) {
          reject(new Error('Process exited with code: ' + code));
        });
      });
    } else {
      return Promise.resolve();
    }
  }

  stop() {
    if (this.javaProcess) {
      this.javaProcess.stdout.removeAllListeners();
      this.javaProcess.stderr.removeAllListeners();

      this.javaProcess.kill();
      this.javaProcess = null;
    }

    return Promise.resolve();
  }
}

module.exports = JarLauncher;