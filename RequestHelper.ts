import * as http from "http";
import {ReqData} from "./interfaces";

export class RequestHelper {
    private readonly serverHost:string;
    private readonly serverPort:number;
    private readonly requestPath:string;

    constructor(host, port, path) {
        this.serverHost = host;
        this.serverPort = port;
        this.requestPath = path;
    }

    async textRequest(text:Buffer, pathCommand:string):Promise<ReqData> {
        let conf: http.ClientRequestArgs = {
            port: this.serverPort,
            host: this.serverHost,
            path: this.requestPath + pathCommand,
            method:"POST",
            headers: {
                "Content-Type": "application/octet-stream",
                "Content-Length": text.byteLength
            }
        }

        return new Promise<ReqData>((resolve, reject) =>{
            let client = http.request(conf, (response:http.IncomingMessage) => {
                const chanks = [];
                response.on('data',chank => chanks.push(chank));
                response.on('end',() => resolve({
                    statusCode:response.statusCode,
                    statusMessage:response.statusMessage,
                    data: Buffer.concat(chanks)
                }));
            });
            client.write(text);
            client.end();
        });
    }

    async textRequestCmd(text:Buffer):Promise<ReqData> {
        return this.textRequest(text, "/cmd");
    }
}