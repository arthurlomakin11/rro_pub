import {RequestAnswer} from "./e-rro";

export async function requestComputing(workerData) {
    let requestType = workerData.requestType;
    let erro = workerData.erro;
    let data = workerData.data;

    let answer:any;
    if(requestType == "OpenShiftRequest") {
        answer = await erro.sendOpenShiftRequest(data.tin, data.ipn, data.orgnm, data.pointnm,
            data.pointaddr, data.orderdate, data.ordertime,
            data.ordernum, data.cashdesknum, data.cashregisternum, data.cashier);
    }
    else if (requestType == "CloseShiftRequest"){
        answer = await erro.sendCloseShiftRequest(data.tin, data.ipn, data.orgnm, data.pointnm,
            data.pointaddr, data.orderdate, data.ordertime,
            data.ordernum, data.cashdesknum, data.cashregisternum, data.cashier);
    }
    else if (requestType == "ZReportRequest") {
        answer = await erro.sendZReportRequest(data.tin, data.ipn, data.orgnm, data.pointnm,
            data.pointaddr, data.orderdate, data.ordertime,
            data.ordernum, data.cashdesknum, data.cashregisternum, data.cashier, data.data);
    }
    else if (requestType == "NewReceiptRequest") {
        answer = await erro.sendNewReceiptRequest(data.tin, data.ipn, data.orgnm, data.pointnm,
            data.pointaddr, data.orderdate, data.ordertime,
            data.ordernum, data.cashdesknum, data.cashregisternum, data.cashier, data.checktotal_sum, data.payments, data.taxes, data.products, data.discount, data.returnReceipt, data.returnReceiptNumber);
    }
    else if (requestType == "CreateXReport") {
        answer = await erro.sendXReportRequest(data.register_number)
    }
    else if(requestType == "NewServiceInputRequest") {
        answer = await erro.sendServiceInputRequest(data.tin, data.ipn, data.orgnm, data.pointnm,
            data.pointaddr, data.orderdate, data.ordertime,
            data.ordernum, data.cashdesknum, data.cashregisternum, data.cashier, data.sum)
    }
    else if(requestType == "NewServiceOutputRequest") {
        answer = await erro.sendServiceOutputRequest(data.tin, data.ipn, data.orgnm, data.pointnm,
            data.pointaddr, data.orderdate, data.ordertime,
            data.ordernum, data.cashdesknum, data.cashregisternum, data.cashier, data.sum)
    }
    else if(requestType == "NewShiftGetRequest") {
        answer = await erro.getShiftsRequest(data.cashregisternum, data.periodStartDate, data.periodEndDate);
    }
    else if(requestType == "NewLocalDocumentsGetRequest") {
        answer = await erro.getLocalDocumentsRequest(data.cashregisternum, data.shiftId, data.OpenShiftFiscalNum);
    }
    else if(requestType == "NewCheckGetRequest") {
        answer = await erro.getCheckRequest(data.cashregisternum, data.NumFiscal);
    }
    else if(requestType == "GetShortPeriodicalReportRequest") {
        answer = await erro.getShortPeriodicalReportRequest(data.cashregisternum, data.periodStartDate, data.periodEndDate);
    }
    else if(requestType == "GetZReportRequest") {
        answer = await erro.getZRepRequest(data.cashregisternum, data.NumFiscal);
    }

    return answer;
}