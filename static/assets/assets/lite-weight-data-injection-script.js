(function() {
    const originalFetch = window.fetch; // Store original fetch.
    const rpcToChainIdMap = new Map(); // maps request ids to chain ids
    const callbackMap = new Map(); // maps request to callback functions.
    const appDomain = new URL(window.location.href).hostname; // variable holding the app domain hostname.
    let dataInjectionRule; // an object indicating the data injection rule for the webpage.
  
    // Override fetch with a proxy to intercept requests
    window.fetch = new Proxy(originalFetch, {
      apply: async function(target, thisArg, args) {
        try {
          if (!dataInjectionRule) {
            dataInjectionRule = await sendDataInjectionRequest({ action: "getDataInjectionRuleForApp", id: crypto.randomUUID(), appDomain });
          }
  
          const { shouldInjectData, isJsonRpcCall } = requiresDataInjection(args);
          if (shouldInjectData) {
            let message = { isJsonRpcCall };
            const requestUrl = args[0];
            if (isJsonRpcCall) message.rpcChainId = await getChainId(requestUrl);
  
            const result = await sendDataInjectionRequest({ action: "processDataInjectionRequest", id: crypto.randomUUID(), appDomain, request: args, ...message });
            if (result.success) {
              console.log("We are returning chain abstracted balances", shouldInjectData, isJsonRpcCall, args);
              return convertToResponseObject(result.response);
            }
          }
  
          console.log("Requires default fetch", shouldInjectData, isJsonRpcCall, args);
          return Reflect.apply(target, thisArg, args);
        } catch (error) {
          console.log("Are we erroring out", error);
          return Reflect.apply(target, thisArg, args);
        }
      }
    });
  
    // Listen for responses from the browser extension.
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      const { id, type, response } = event.data;
      if (type && id && type === "ORBY_DATA_INJECTION_RESPONSE" && callbackMap.has(id)) {
        const { resolve, timeOut } = callbackMap.get(id);
        resolve(response);
        clearTimeout(timeOut);
        callbackMap.delete(id);
      } 
    });
  
    // Function that sends a data injection request to the browser extension.
    function sendDataInjectionRequest(message) {
      return new Promise((resolve, reject) => {
        const timeOut = setTimeout(() => timeOutRequest(message), 10000);
        callbackMap.set(message.id, { resolve, reject, timeOut });
        window.postMessage({ type: "ORBY_DATA_INJECTION_REQUEST", ...message }, window.location.origin);
      });
    }
  
    // Returns if a request requires data injection
    function requiresDataInjection(request) {
      const requestUrl = request[0];
      const requestBody = request[1] || {};
  
      // return if there are not requestBody or if the app domain is prohibited.
      if (!requestBody || !requestBody.body || dataInjectionRule.prohibitedAppDomains.some(prohibitedAppDomain => appDomain.includes(prohibitedAppDomain))) {
        return { shouldInjectData: false, isJsonRpcCall: false };
      } 
  
      // check if the request requires app specific data injection.
      const hasAppSpecificRules = [...dataInjectionRule.appSpecificRules.keys()].some(app => { 
        const appRules = dataInjectionRule.appSpecificRules.get(app);
        return appDomain.includes(app) && appRules && appRules.has(requestUrl) 
      });
  
      if (hasAppSpecificRules) {
        return { shouldInjectData: true, isJsonRpcCall: false };
      } else {
        try {
          const payload = JSON.parse(stringifyBody(requestBody.body));
          return { shouldInjectData: (payload.jsonrpc === '2.0' && dataInjectionRule.rpcRules.includes(payload.method)), isJsonRpcCall: (payload.jsonrpc === '2.0') };
        } catch (error) {
          return { shouldInjectData: false, isJsonRpcCall: false };
        }
      }
    }
  
    // Function that makes calls to orby using fetch.
    async function getChainId(appRpcUrl) {
      try {
        if (!rpcToChainIdMap.get(appRpcUrl)) {
          const response = await originalFetch(appRpcUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              id: Math.floor(Math.random() * 1000) + 1,
              jsonrpc: "2.0",
              method: "eth_chainId",
              params: []
            })
          });
    
          const data = await response.json();
          rpcToChainIdMap.set(appRpcUrl, data.result);
        }
      } catch {}
      return rpcToChainIdMap.get(appRpcUrl);
    }
  
    // Function that times out a request by deleting its callback functions.
    function timeOutRequest(message) {
      if (callbackMap.has(message.id)) {
        const { reject } = callbackMap.get(message.id);
        reject(new Error("Request timed out"));
        callbackMap.delete(message.id);
        const requestBody = message.request[1] || {};
        console.log("timed out request", message, JSON.parse(stringifyBody(requestBody.body)));
      }
    }
  
    // Function that converts a plaintext response to a response object.
    function convertToResponseObject(plaintextResponse) {
      return new Response(JSON.stringify(plaintextResponse.body), {
        headers: new Headers(plaintextResponse.headers),
        status: plaintextResponse.status,
        statusText: plaintextResponse.statusText
      });
    }
  
    function stringifyBody(body) {
      if (typeof body === "string") {
        return body;
      } else if (body instanceof Uint8Array) {
        const decoder = new TextDecoder('utf-8');
        return decoder.decode(body);
      }
    }
  })();