window.onload = function () {
    chrome.storage.sync.get({"resolution": "1080"}, function(data) {
        document.getElementById(data["resolution"]).checked = true;
    });

    var radios = document.forms["quality"].elements["resolution"];
    for(var i = 0; i < radios.length; i++) {
        radios[i].onclick = function() {
            var radio_data = {};
            radio_data["event"] = "resolutionSwitch";
            radio_data["value"] = this.value;

            chrome.runtime.sendMessage(radio_data);
            chrome.storage.sync.set({"resolution": this.value});
            
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {"event": "restartVideo"});
            });
        }
    }
}