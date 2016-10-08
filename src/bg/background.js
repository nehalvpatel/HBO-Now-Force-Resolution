var allTabs = {};

var desiredResolution = "1080";
chrome.storage.sync.get({ "resolution": "1080" }, function(data) {
    resolutionSwitched(data["resolution"]);
});

chrome.webRequest.onBeforeRequest.addListener(handleRequest, { urls: ["*://*.hbonow.com/hls*"] }, ["blocking"]);
function handleRequest(details) {
    if (details.url.indexOf("master") != -1) {
        if (details.tabId > -1) {
            console.log("[#" + details.tabId + "] New playlist.");

            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function() {
                if (xhr.readyState == XMLHttpRequest.DONE) {
                    var tabStreams = [];
                    const regex = /.*?(BANDWIDTH)(.*?)(,)(RESOLUTION)(.*?)(,)/i;

                    let m;
                    var currentStream = {};
                    var hasDesiredHeight = false;
                    var lines = xhr.responseText.split('\n');
                    for (var i = 0; i < lines.length; i++) {
                        if (lines[i].indexOf("EXT-X-STREAM-INF") !== -1) {
                            if ((m = regex.exec(lines[i])) !== null) {
                                let resolution = m[5].replace("=", "").split("x");
                                currentStream["height"] = resolution[1];

                                if (currentStream["height"] == desiredResolution) {
                                    hasDesiredHeight = true;
                                }
                            }
                        } else if (lines[i].indexOf(".m3u8") !== -1) {
                            if (lines[i].indexOf("URI") === -1) {
                                currentStream["url"] = details.url.substring(0, details.url.lastIndexOf("/")) + "/" + lines[i];

                                tabStreams.push(currentStream);
                                currentStream = {};
                            }
                        }
                    }
                    
                    allTabs[details.tabId] = {};
                    allTabs[details.tabId]["streams"] = tabStreams;

                    if (hasDesiredHeight) {
                        console.log("[#" + details.tabId + "] Has desired height of " + desiredResolution + "p.");
                    } else {
                        console.log("[#" + details.tabId + "] Does not have desired height of " + desiredResolution + "p.");
                    }

                    allTabs[details.tabId]["hasDesiredHeight"] = hasDesiredHeight;
                    allTabs[details.tabId]["targetResolution"] = calculateTarget(details.tabId, allTabs[details.tabId]["streams"]);
                }
            }

            xhr.open("GET", details.url);
            xhr.send(null);
        }
    } else {
        if (allTabs.hasOwnProperty(details.tabId)) {
            let streams = allTabs[details.tabId]["streams"];
            let targetResolution = allTabs[details.tabId]["targetResolution"];

            for (var i = 0; i < streams.length; i++) {
                let stream = streams[i];
                if (stream["url"] == details.url) {
                    if (stream["height"] != targetResolution) {
                        console.log("[#" + details.tabId + "] Cancelled " + stream["height"] + "p.");

                        return {
                            cancel: true
                        };
                    } else {
                        console.log("[#" + details.tabId + "] Allowed " + stream["height"] + "p.");
                    }
                }
            }
        }
    }

    return {
        cancel: false
    };
}

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request.event == "resolutionSwitch") {
            resolutionSwitched(request["value"]);
        }
    }
);

chrome.runtime.onInstalled.addListener(function() {
    chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
        chrome.declarativeContent.onPageChanged.addRules([{
            conditions: [
                new chrome.declarativeContent.PageStateMatcher({
                    pageUrl: {
                        hostContains: "hbonow.com"
                    },
                })
            ],
            actions: [new chrome.declarativeContent.ShowPageAction()]
        }]);
    });
});

function resolutionSwitched(res) {
    console.log("Desired resolution is " + res + "p.");
    desiredResolution = res;

    for (var tabId in allTabs) {
        // skip loop if the property is from prototype
        if (!allTabs.hasOwnProperty(tabId)) continue;

        allTabs[tabId]["targetResolution"] = calculateTarget(tabId, allTabs[tabId]["streams"]);
    }
}

function calculateTarget(tabid, strs) {
    let actualStreams = [];
    for (var i = 0; i < strs.length; i++) {
        actualStreams.push(parseInt(strs[i]["height"]));
    }

    let closestResolution = closest(actualStreams, desiredResolution);
    console.log("[#" + tabid + "] " + "Target resolution is " + closestResolution + "p.");

    return closestResolution;
}

function closest(arr, closestTo){
    var closest = Math.max.apply(null, arr);
    
    for(var i = 0; i < arr.length; i++){
        if(arr[i] >= closestTo && arr[i] < closest) closest = arr[i];
    }
    
    return closest;
}