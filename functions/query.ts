import * as url from "url";
import * as http from "http";
const process = require('process');

export function query(method, toUrl, headers, payload, cb) {
    try {
        let time = performance.now()
        let parsed = url.parse(toUrl);
        let req = http.request({
            host: parsed.host,
            path: parsed.path,
            headers: headers,
            method: method,
        }, res => {
            let chunks = [];
            res.on("data", chunk => {
                chunks.push(chunk);
            });
            res.on("end", () => {
                cb(Buffer.concat(chunks));
            });
            res.on("error", () => {
                console.log("SOCKET ERR!!!");
                req.end();
                cb(null);
            });
        });
        req.on("error", e => {
            console.log("SOCKET ERR!!!");
            req.end();
            cb(null);
        });
        req.write(payload);
        req.end();
        console.log(`Time Taken to execute query function = ${(performance.now() - time)} milliseconds`);
    }
    catch(e) {
        console.log("Error in query function: " + e.message);
    }
}