const headers = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
};
const body = {
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    downloadMode: "auto",
    videoQuality: "1080",
    audioFormat: "mp3",
    filenameStyle: "basic"
};

fetch("https://api.cobalt.tools/", {
    method: "POST",
    headers,
    body: JSON.stringify(body)
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
