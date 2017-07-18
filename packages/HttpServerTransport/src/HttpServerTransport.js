import get from 'lodash/get';
import Promise from 'bluebird';
import { EventEmitter } from 'events';
import express from 'express';
import bodyParser from 'body-parser';

function getRequestId(command) {
  return get(command, 'headers.requestId');
}

function getQueueName(command) {
  return get(command, 'headers.queueName');
}

class HttpServerTransport {
  constructor({server, log, sendingOnly}) {
    this.log = log;
    this.sendingOnly = sendingOnly;
    this.messageHandler = new EventEmitter();
    this.requestHandler = new EventEmitter();

    this.listenOnServer(server);
  }

  listenOnServer(server) {
    const app = express();
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.json());

    server.on('request', app);

    app.post(HttpServerTransport.ENQUEUE_URI, (req, res) => {
      const reqCommand = get(req, 'body.data');
      this.requestHandler.once(get(reqCommand, 'headers.id'), (resCommand) => {
        res.send(resCommand);
      });
      this.messageHandler.emit(getQueueName(reqCommand), reqCommand);
    });
  }

  enqueue(queueName, command) {
    this.requestHandler.emit(getRequestId(command), command);
    return Promise.resolve();
  }

  process(queueName, callback) {
    this.messageHandler.on(queueName, (command) => {
      callback(command);
    });
    return Promise.resolve();
  }
}

HttpServerTransport.START_2016 = new Date(2016, 1, 1).getTime();
HttpServerTransport.ENQUEUE_URI = '/stellar/enqueue';

export default HttpServerTransport;
