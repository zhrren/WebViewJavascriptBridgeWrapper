/*!
 * WebViewJavascriptBridge.js v0.0.1
 * (c) 2015 Mark
 * Released under the MIT License.
 */

var WebViewJavascriptBridge = (function () {

    var IOSWebViewJavascriptBridge = (function () {
        var _messagingIframe;
        var _sendMessageQueue = [];
        var _receiveMessageQueue = [];
        var _messageHandlers = {};

        var _CUSTOM_PROTOCOL_SCHEME = 'wvjbscheme';
        var _QUEUE_HAS_MESSAGE = '__WVJB_QUEUE_MESSAGE__';

        var _responseCallbacks = {};
        var _uniqueId = 1;

        var _messageHandler;

        function _createQueueReadyIframe(doc) {
            _messagingIframe = doc.createElement('iframe');
            _messagingIframe.style.display = 'none';
            _messagingIframe.src = _CUSTOM_PROTOCOL_SCHEME + '://' + _QUEUE_HAS_MESSAGE;
            doc.documentElement.appendChild(_messagingIframe);
        }

        function init(messageHandler) {
            if (_messageHandler) {
                throw new Error('WebViewJavascriptBridge.init called twice')
            }
            _createQueueReadyIframe(document);

            _messageHandler = messageHandler;
            var receivedMessages = _receiveMessageQueue;
            _receiveMessageQueue = null;
            for (var i = 0; i < receivedMessages.length; i++) {
                _dispatchMessageFromObjC(receivedMessages[i]);
            }
        }

        function send(data, responseCallback) {
            _doSend({data: data}, responseCallback);
        }

        function registerHandler(handlerName, handler) {
            _messageHandlers[handlerName] = handler;
        }

        function callHandler(handlerName, data, responseCallback) {
            _doSend({handlerName: handlerName, data: data}, responseCallback);
        }

        function _doSend(message, responseCallback) {
            if (responseCallback) {
                var callbackId = 'cb_' + (_uniqueId++) + '_' + new Date().getTime();
                _responseCallbacks[callbackId] = responseCallback;
                message['callbackId'] = callbackId
            }
            _sendMessageQueue.push(message);
            _messagingIframe.src = _CUSTOM_PROTOCOL_SCHEME + '://' + _QUEUE_HAS_MESSAGE;
        }

        function _fetchQueue() {
            var messageQueueString = JSON.stringify(_sendMessageQueue);
            _sendMessageQueue = [];
            return messageQueueString;
        }

        function _dispatchMessageFromObjC(messageJSON) {
            setTimeout(function _timeoutDispatchMessageFromObjC() {
                var message = JSON.parse(messageJSON);
                var messageHandler;

                if (message.responseId) {
                    var responseCallback = _responseCallbacks[message.responseId];
                    if (!responseCallback) {
                        return;
                    }
                    responseCallback(message.responseData);
                    delete _responseCallbacks[message.responseId];
                } else {
                    var responseCallback;
                    if (message.callbackId) {
                        var callbackResponseId = message.callbackId;
                        responseCallback = function (responseData) {
                            _doSend({responseId: callbackResponseId, responseData: responseData});
                        }
                    }

                    var handler = _messageHandler;
                    if (message.handlerName) {
                        handler = _messageHandlers[message.handlerName];
                    }

                    try {
                        handler(message.data, responseCallback)
                    } catch (exception) {
                        if (typeof console != 'undefined') {
                            console.log("WebViewJavascriptBridge: WARNING: javascript handler threw.", message, exception);
                        }
                    }
                }
            })
        }

        function _handleMessageFromObjC(messageJSON) {
            if (_receiveMessageQueue) {
                _receiveMessageQueue.push(messageJSON)
            } else {
                _dispatchMessageFromObjC(messageJSON)
            }
        }

        return {
            init: init,
            send: send,
            registerHandler: registerHandler,
            callHandler: callHandler,
            _fetchQueue: _fetchQueue,
            _handleMessageFromObjC: _handleMessageFromObjC
        }
    })();

    var AndroidWebViewJavascriptBridge = (function () {
        var _messageHandlers = {};
        var _responseCallbacks = {};
        var _uniqueId = 1;
        var _messageHandler;

        function init(messageHandler) {
            if (_messageHandler) {
                throw new Error('WebViewJavascriptBridge.init called twice')
            }
            _messageHandler = messageHandler;
        }

        function send(data, responseCallback) {
            _doSend({data: data}, responseCallback);
        }

        function registerHandler(handlerName, handler) {
            _messageHandlers[handlerName] = handler;
        }

        function callHandler(handlerName, data, responseCallback) {
            _doSend({handlerName: handlerName, data: data}, responseCallback);
        }

        function _doSend(message, responseCallback) {
            console.log("responseCallback:" + responseCallback);
            if (responseCallback) {
                var callbackId = 'cb_' + (_uniqueId++) + '_' + new Date().getTime();
                _responseCallbacks[callbackId] = responseCallback;
                message['callbackId'] = callbackId;
            }
            console.log("sending:" + JSON.stringify(message));
            try {
                _WebViewJavascriptBridge._handleMessageFromJs(message.data || null, message.responseId || null,
                    message.responseData || null, message.callbackId || null, message.handlerName || null);
            } catch (e) {
                console.log(e);
            }
        }

        function _dispatchMessageFromJava(messageJSON) {
            var message = JSON.parse(messageJSON);
            var messageHandler;
            var responseCallback;

            if (message.responseId) {
                responseCallback = _responseCallbacks[message.responseId];
                if (!responseCallback) {
                    return;
                }
                responseCallback(message.responseData);
                delete _responseCallbacks[message.responseId];
            } else {
                if (message.callbackId) {
                    var callbackResponseId = message.callbackId;
                    responseCallback = function (responseData) {
                        _doSend({responseId: callbackResponseId, responseData: responseData});
                    }
                }

                var handler = _messageHandler;
                if (message.handlerName) {
                    handler = _messageHandlers[message.handlerName];
                }
                try {
                    handler(message.data, responseCallback);
                } catch (exception) {
                    if (typeof console != 'undefined') {
                        console.log("WebViewJavascriptBridge: WARNING: javascript handler threw.", message, exception);
                    }
                }
            }
        }


        function _handleMessageFromJava(messageJSON) {
            _dispatchMessageFromJava(messageJSON);
        }

        return {
            init: init,
            send: send,
            registerHandler: registerHandler,
            callHandler: callHandler,
            _handleMessageFromJava: _handleMessageFromJava
        };

    })();

    return {
        init: function (native, messageHandler) {
            switch (native){
                case 'ios':
                    WebViewJavascriptBridge.send = IOSWebViewJavascriptBridge.send;
                    WebViewJavascriptBridge.registerHandler = IOSWebViewJavascriptBridge.registerHandler;
                    WebViewJavascriptBridge.callHandler = IOSWebViewJavascriptBridge.callHandler;
                    WebViewJavascriptBridge._fetchQueue = IOSWebViewJavascriptBridge._fetchQueue;
                    WebViewJavascriptBridge._handleMessageFromObjC = IOSWebViewJavascriptBridge._handleMessageFromObjC;
                    IOSWebViewJavascriptBridge.init(messageHandler);
                    break;
                case 'android':
                    WebViewJavascriptBridge.send = AndroidWebViewJavascriptBridge.send;
                    WebViewJavascriptBridge.registerHandler = AndroidWebViewJavascriptBridge.registerHandler;
                    WebViewJavascriptBridge.callHandler = AndroidWebViewJavascriptBridge.callHandler;
                    WebViewJavascriptBridge._handleMessageFromJava = AndroidWebViewJavascriptBridge._handleMessageFromJava;
                    AndroidWebViewJavascriptBridge.init(messageHandler);
                    break;
                default :
                    throw 'native is not valid. value is ios or android.';
                    break;
            }
        }
    };

})();