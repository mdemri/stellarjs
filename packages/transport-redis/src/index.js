/**
 * Created by arolave on 05/10/2016.
 */
/* eslint-disable */
const http = require('http');
const uuid = require('uuid');
const Promise = require('bluebird');
const _ = require('lodash');

const { StellarHandler, StellarPubSub, StellarRequest } = require('@stellarjs/core');
const redisTransportFactory = require('./redisTransportFactory');

const requestTimeout = 3000; // TODO set from env variable or options obj

let log = null;
function configureStellarLog(serverLog) {
    if (serverLog) {
        log = serverLog;
    }
}
configureStellarLog(console);

function generateSource() {
    const getFromInstanceId = (instanceId) => {
        const app = process.env.APP;
        return app ? `${app}:${instanceId}` : instanceId;
    };

    if (process.env.NODE_ENV === 'test') {
        log.info(`@StellarCore: sending request`);
        log.info(`@StellarCore Running test`);
        return Promise.resolve(getFromInstanceId(uuid.v4()));
    }

    return new Promise((resolve) => {
        http.get({ host: 'http://169.254.169.254', path: '/latest/meta-data/instance-id', timeout: 1000 }, (res) => {
            if (res.statusCode !== 200) {
                log.info(`@StellarCore: Running standard`);
                resolve(getFromInstanceId(uuid.v4()));
            }

            res.setEncoding('utf8');
            let body = '';
            res.on('data', (data) => {
                log.info(`@StellarCore: data ${data}`);
                body += data;
            });
            res.on('end', () => {
                log.info(`@StellarCore: Running in AWS`);
                log.info(`@StellarCore: end ${body}`);
                resolve(getFromInstanceId(body));
            });
        }).on('error', () => {
            log.info(`@StellarCore: Running standard`);
            resolve(getFromInstanceId(uuid.v4()));
        });
    });
}

let setSource = null;

const StellarServer = { instances: {} };

function doSetSource(s) {
    setSource = s;

    _.forEach(['stellarRequest', 'stellarHandler', 'stellarAppPubSub', 'stellarNodePubSub'], (name) => {
        const instance = _.get(StellarServer.instances, name);
        if (instance) {
            log.info(`setting source on ${name}`);
            instance.setSource(s);
        }
    });
}

function configureStellar(_log, _source) {
    configureStellarLog(_log);
    if (_source) {
        doSetSource(_source);  // overrides generated source
    }
}

generateSource().then((source) => {
    log.info(`setting source ${source}`);
    doSetSource(source);
});

function _getInstance(name, builder) {
    if (!StellarServer.instances[name]) {
        StellarServer.instances[name] = builder.apply();
    }
    return StellarServer.instances[name];
}

function stellarAppPubSub(app = process.env.APP) {
    return _getInstance('stellarAppPubSub', () => new StellarPubSub(redisTransportFactory(log), setSource, log, app));
}

function stellarNodePubSub() {
    return _getInstance('stellarNodePubSub', () => new StellarPubSub(redisTransportFactory(log), setSource, log));
}

function stellarRequest() {
    console.log(`stellarRequest creation ${setSource}`);
    return _getInstance('stellarRequest',
                        () => new StellarRequest(redisTransportFactory(log), setSource, log, requestTimeout, stellarNodePubSub()));
}

function stellarHandler(app = process.env.APP) {
    return _getInstance('stellarHandler', () => new StellarHandler(redisTransportFactory(log), setSource, log, app));
}

function stellarPublish(app) {
    return _getInstance('stellarPublish', () => {
        const pubsub = stellarAppPubSub(app);
        return pubsub.publish.bind(pubsub);
    });
}

function stellarSubscribe(app) {
    return _getInstance('stellarSubscribe', () => {
        const pubsub = stellarAppPubSub(app);
        return pubsub.subscribe.bind(pubsub);
    });
}

function stellarSource() {
    return stellarRequest().source;
}

module.exports = {
    stellarRequest,
    stellarHandler,
    stellarAppPubSub,
    stellarNodePubSub,
    configureStellar,
    stellarPublish,
    stellarSubscribe,
    stellarSource,
};
