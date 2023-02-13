import * as txml from "txml";

export function xmlToJson(data) {
    return txml.simplify(txml.parse(data));
}