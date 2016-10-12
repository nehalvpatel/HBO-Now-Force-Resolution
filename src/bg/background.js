var allTabs = {};
var desiredResolution;
const playlistRegex = [
    {
        "regex": /.*?(BANDWIDTH)[=](.*?)[,](CODECS)[=](.*?)(RESOLUTION)[=](.*?)[,](CLOSED-CAPTIONS)[=](.*?)[\r\n?|\n](.*?)[\r\n?|\n]/gi,
        "resolutionIndex": 6,
        "urlIndex": 9
    },
    {
        "regex": /.*?(BANDWIDTH)[=](.*?)[,](CODECS)[=](.*?)(RESOLUTION)[=](.*?)[,](URI)[=]"(.*?)"[\r\n?|\n]/gi,
        "resolutionIndex": 6,
        "urlIndex": 8
    }
];

chrome.webRequest.onBeforeRequest.addListener(handleRequest, { urls: ["*://*.hbonow.com/*master*m3u8"] }, ["blocking"]);

chrome.storage.sync.get({ "resolution": 1080 }, function(data) {
    initAnalytics("background.html", data["resolution"] + "p");
    resolutionSwitched(data["resolution"]);
});

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

function handleRequest(details) {
    if (details.tabId > -1) {
        logData(details.tabId, "New playlist.");

        let playlistRequest = new XMLHttpRequest();
        playlistRequest.onreadystatechange = function() {
            if (playlistRequest.readyState == XMLHttpRequest.DONE) {
                if (playlistRequest.getResponseHeader("Content-Type") == "audio/x-mpegurl") {
                    removeListeners(details.tabId);

                    let currentTab = {};
                    currentTab["handlers"] = [];
                    currentTab["resolutions"] = [];
                    currentTab["streams"] = [];

                    for (let i = 0; i < playlistRegex.length; i++) {
                        let currentMatches = matchPlaylist(playlistRegex[i], playlistRequest.responseText, details.url);
                        Array.prototype.push.apply(currentTab["resolutions"], currentMatches["resolutions"]);
                        Array.prototype.push.apply(currentTab["streams"], currentMatches["streams"]);
                    }

                    if (currentTab["resolutions"].indexOf(desiredResolution) > -1) {
                        logData(details.tabId, "Has desired height of " + desiredResolution + "p.");
                    } else {
                        logData(details.tabId, "Does not have desired height of " + desiredResolution + "p.");
                    }

                    allTabs[details.tabId] = currentTab;
                    calculateStreams(details.tabId);
                }
            }
        }

        playlistRequest.open("GET", details.url);
        playlistRequest.send(null);
    }

    return {
        cancel: false
    };
}

function resolutionSwitched(resolution) {
    logData(null, "Desired resolution is " + resolution + "p.");

    desiredResolution = parseInt(resolution);

    Object.keys(allTabs).forEach(function (tabId) {
        tabId = parseInt(tabId);
        
        removeListeners(tabId);
        calculateStreams(tabId);
    });
}

function removeListeners(tabId) {
    if (allTabs[tabId]) {
        for (let i = 0; i < allTabs[tabId]["handlers"].length; i++) {
            chrome.webRequest.onBeforeRequest.removeListener(allTabs[tabId]["handlers"][i]);
        }
        
        allTabs[tabId]["handlers"] = [];
    }
}

function calculateStreams(tabId) {
    let allStreams = allTabs[tabId]["streams"];

    let targetResolution = closest(allTabs[tabId]["resolutions"], desiredResolution);
    logData(tabId, "Target resolution is " + targetResolution + "p.");

    for (let i = 0; i < allStreams.length; i++) {
        let currentStream = allStreams[i];
        let handlerIndex;

        if (currentStream["height"] == targetResolution) {
            handlerIndex = allTabs[tabId]["handlers"].push(function(details) {
                let currentResolution = currentStream["height"];
                logData(details.tabId, "Allowed " + currentResolution + "p.");

                chrome.tabs.sendMessage(details.tabId, { "event": "getTitle" }, function(content) {
                    ga("send", "event", "Video", "Play",
                        {
                            "dimension1": content["videoTitle"],
                            "dimension2": desiredResolution + "p",
                            "dimension3": currentResolution + "p"
                        }
                    );
                });

                return {
                    cancel: false
                };
            }) - 1;
        } else {
            handlerIndex = allTabs[tabId]["handlers"].push(function(details) {
                let currentResolution = currentStream["height"];
                logData(details.tabId, "Cancelled " + currentResolution + "p.");

                return {
                    cancel: true
                };
            }) - 1;
        }

        chrome.webRequest.onBeforeRequest.addListener(allTabs[tabId]["handlers"][handlerIndex],
            {
                "urls": [currentStream["url"]],
                "tabId": tabId
            },
            ["blocking"]
        );
    }
}

function matchPlaylist(regex, playlist, url) {
    let currentRegex = regex["regex"];
    let resolutions = [];
    let streams = [];

    let matches;
    while ((matches = currentRegex.exec(playlist)) !== null) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (matches.index === currentRegex.lastIndex) {
            currentRegex.lastIndex++;
        }
        
        let currentHeight = parseInt(matches[regex["resolutionIndex"]].split("x")[1]);
        resolutions.push(currentHeight);

        streams.push({
            "height": currentHeight,
            "url": url.substring(0, url.lastIndexOf("/")) + "/" + matches[regex["urlIndex"]]
        });
    }

    return {
        "resolutions": resolutions,
        "streams": streams
    };
}

function closest(arr, closestTo) {
    let closest = Math.max.apply(null, arr);
    
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] >= closestTo && arr[i] < closest) closest = arr[i];
    }
    
    return closest;
}

function logData(tabId, message) {
    if (tabId !== null) {
        if (message == "New playlist.") {
            console.log("%c[#" + tabId + "] " + message, "font-weight: bold;");
        } else {
            console.log("[#" + tabId + "] " + message);
        }
    } else {
        console.log(message);
    }
}