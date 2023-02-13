import {RequestHelper} from "./RequestHelper.js";
import {v4 as uuidv4} from 'uuid';
import * as iconv from "iconv";
import {
	create_xml_document,
	create_z_rep_document,
	generate_service_input,
	generate_service_output,
	generate_shifts_close,
	generate_shifts_open,
	generate_zrep
} from "./xml-documents-generator.js";
import generate_product_sell from "./generate_product_sell";
import {ResponseShifts} from "./interfaces";
import {Runtime} from "artbox_db/index.js"
const Decimal = Runtime.Decimal;
import {xmlToJson} from "./functions/xmlToJson";
import {CurrentDate} from "./functions/CurrentDate";
import axios from "axios";


export interface SettingsOptions {
	host:string,
	port:number,
	requestPath:string,

	pass:string,
	role:string

	keyPath:string,
	certPath:string,
}

export interface RequestAnswer {
	data: any,
	statusCode: number,
	statusMessage: string,
	metaData?: string
}


export class ERROClient {
	private requestHelper:RequestHelper;
	private options:any;

	constructor(options:SettingsOptions) {
		this.options = options;
		this.requestHelper = new RequestHelper(options.host, options.port, options.requestPath);
	}

	private async signedRequestNew(data:string, pathCommand: string):Promise<RequestAnswer> {
		try {
			let conv = new iconv.Iconv('utf-8//IGNORE', 'windows-1251//IGNORE');
			let encodedBuffer = conv.convert(data);

			const signed = await axios.post("http://localhost:2333/sign", encodedBuffer, {
				params: {
					pass: this.options.pass,
					role: this.options.role,
					keyPath: this.options.keyPath,
					certPath: this.options.certPath
				},
				headers: {
					"Content-Type": "application/octet-stream"
				},
				responseType: "arraybuffer"
			})

			let answer = await this.requestHelper.textRequest(signed.data, pathCommand);

			const unwrapped = await axios.post("http://localhost:2333/unwrap", answer.data, {
				params: {
					pass: this.options.pass,
					role: this.options.role,
					keyPath: this.options.keyPath,
					certPath: this.options.certPath
				},
				headers: {
					"Content-Type": "application/octet-stream"
				}
			})

			return {
				data: unwrapped.data,
				statusCode: answer.statusCode,
				statusMessage: answer.statusMessage
			}
		}
		catch (e) {
			console.log(e);
			return {
				data: e.message,
				statusCode: 500,
				statusMessage: "error"
			}
		}
	}

	private async metadataInjectedSignedRequestNew(data:string, pathCommand: string):Promise<RequestAnswer> {
		const request = await this.signedRequestNew(data, pathCommand)
		request.metaData = data

		return request
	}


	async sendOpenShiftRequest(tin, ipn, orgnm, pointnm, pointaddr, orderdate, ordertime, ordernum, cashdesknum, cashregisternum, cashier):Promise<RequestAnswer> {
		const new_uuid = uuidv4()

		let xml_string = create_xml_document(
			generate_shifts_open(
				new_uuid, tin, ipn, orgnm, pointnm,
				pointaddr, orderdate, ordertime,
				ordernum, cashdesknum, cashregisternum, cashier
			)
		)

		return this.signedRequestNew(xml_string, "/doc");
	}

	async sendServiceInputRequest(tin, ipn, orgnm, pointnm, pointaddr, orderdate, ordertime, ordernum, cashdesknum, cashregisternum, cashier, sum):Promise<RequestAnswer> {
		const new_uuid = uuidv4()

		let xml_string = create_xml_document(
			generate_service_input(
				new_uuid, tin, ipn, orgnm, pointnm,
				pointaddr, orderdate, ordertime,
				ordernum, cashdesknum, cashregisternum, cashier, sum
			)
		)

		return this.signedRequestNew(xml_string, "/doc");
	}

	async sendServiceOutputRequest(tin, ipn, orgnm, pointnm, pointaddr, orderdate, ordertime, ordernum, cashdesknum, cashregisternum, cashier, sum):Promise<RequestAnswer> {
		const new_uuid = uuidv4()

		let xml_string = create_xml_document(
			generate_service_output(
				new_uuid, tin, ipn, orgnm, pointnm,
				pointaddr, orderdate, ordertime,
				ordernum, cashdesknum, cashregisternum, cashier, sum
			)
		)

		return this.signedRequestNew(xml_string, "/doc");
	}

	async sendCloseShiftRequest(tin, ipn, orgnm, pointnm, pointaddr, orderdate, ordertime, ordernum, cashdesknum, cashregisternum, cashier):Promise<RequestAnswer> {
		const new_uuid = uuidv4()

		let xml_string = create_xml_document(
			generate_shifts_close(
				new_uuid, tin, ipn, orgnm, pointnm,
				pointaddr, orderdate, ordertime,
				ordernum, cashdesknum, cashregisternum, cashier
			)
		)

		return this.signedRequestNew(xml_string, "/doc");
	}

	async sendZReportRequest(tin, ipn, orgnm, pointnm, pointaddr, orderdate, ordertime, ordernum, cashdesknum, cashregisternum, cashier, data):Promise<RequestAnswer> {
		const new_uuid = uuidv4()

		let xml_string = create_z_rep_document(
			generate_zrep(
				new_uuid, tin, ipn, orgnm, pointnm,
				pointaddr, orderdate, ordertime,
				ordernum, cashdesknum, cashregisternum, cashier, data
			)
		)

		return this.metadataInjectedSignedRequestNew(xml_string, "/doc");
	}

	async sendNewReceiptRequest(tin, ipn, orgnm, pointnm, pointaddr, orderdate, ordertime, ordernum, cashdesknum, cashregisternum, cashier, checktotal_sum, payments, taxes, products, discount, returnReceipt, returnReceiptNumber) {
		const new_uuid = uuidv4()

		let xml_string = create_xml_document(
			generate_product_sell(
				new_uuid, tin, ipn, orgnm, pointnm,
				pointaddr, orderdate, ordertime,
				ordernum, cashdesknum, cashregisternum, cashier,
				checktotal_sum, payments, taxes, products, discount, returnReceipt, returnReceiptNumber
			)
		)

		return await this.signedRequestNew(xml_string, "/doc");
	}

	async sendXReportRequest(cashregisternum:string) {
		let json_string = {
			"Command": "LastShiftTotals",
			"NumFiscal": cashregisternum
		}

		return this.signedRequestNew(JSON.stringify(json_string), "/cmd");
	}


	async getShiftsRequest(cashregisternum:string, periodStartDate:Date, periodEndDate:Date) {
		let json_string = {
			"Command": "Shifts",
			"NumFiscal": cashregisternum,
			"From": CurrentDate.DateAddTimezoneOffset(periodStartDate).toISOString(),
			"To": CurrentDate.DateAddTimezoneOffset(periodEndDate).toISOString()
		}

		return this.signedRequestNew(JSON.stringify(json_string), "/cmd");
	}

	async getLocalDocumentsRequest(cashregisternum:string, shiftId:number, OpenShiftFiscalNum:string) {
		let json_string = {
			"Command": "Documents",
			"NumFiscal": cashregisternum,
			"ShiftId": shiftId,
			"OpenShiftFiscalNum": OpenShiftFiscalNum
		}

		return this.signedRequestNew(JSON.stringify(json_string), "/cmd");
	}

	async getCheckRequest(cashregisternum:string, NumFiscal:number) {
		let json_string = {
			"Command": "Check",
			"RegistrarNumFiscal": cashregisternum,
			"NumFiscal": NumFiscal,
			"Original": true
		}

		return this.signedRequestNew(JSON.stringify(json_string), "/cmd");
	}

	async getZRepRequest(cashregisternum:string, NumFiscal:number) {
		let json_string = {
			"Command": "ZRep",
			"RegistrarNumFiscal": cashregisternum,
			"NumFiscal": NumFiscal,
			"Original": false
		}

		return this.signedRequestNew(JSON.stringify(json_string), "/cmd");
	}

	async getShortPeriodicalReportRequest(cashregisternum:string, periodStartDate:Date, periodEndDate:Date) {
		const shiftsAnswer = await this.getShiftsRequest(cashregisternum, periodStartDate, periodEndDate);

		let json_answer:ResponseShifts = shiftsAnswer.data;

		let totalPeriodPayforms = [];
		if(!json_answer.Shifts) {
			throw new Error("No shifts found");
		}

		for (const shift of json_answer.Shifts) {
			let ZRepFiscalNum = Number.parseInt(shift.ZRepFiscalNum);
			if(!Number.isNaN(ZRepFiscalNum)) {
				let ZRepDocument = await this.getZRepRequest(cashregisternum, ZRepFiscalNum);

				let jsonZRepAllDoc = xmlToJson(ZRepDocument.data);

				let jsonZRep = jsonZRepAllDoc.ZREP;

				let zRepPayforms = [];
				if(jsonZRep.ZREPREALIZ) {
					let ZREPREALIZPAYFORMS = [];
					if(jsonZRep.ZREPREALIZ.PAYFORMS) {
						let payforms = jsonZRep.ZREPREALIZ.PAYFORMS;

						if(Array.isArray(payforms.ROW)){
							ZREPREALIZPAYFORMS = [...payforms.ROW];
						}
						else {
							ZREPREALIZPAYFORMS.push(payforms.ROW);
						}

						for(const zRepRealizPayform of ZREPREALIZPAYFORMS) {
							zRepPayforms.push({
								realizSum: new Decimal(zRepRealizPayform.SUM),
								code: Number.parseInt(zRepRealizPayform.PAYFORMCD)
							})
						}
					}
				}
				if(jsonZRep.ZREPRETURN) {
					let ZREPRETURNPAYFORMS = [];
					let payforms = jsonZRep.ZREPRETURN.PAYFORMS;
					if(Array.isArray(payforms.ROW)){
						ZREPRETURNPAYFORMS = [...payforms.ROW];
					}
					else {
						ZREPRETURNPAYFORMS.push(payforms.ROW);
					}

					for(const zRepReturnPayform of ZREPRETURNPAYFORMS) {
						let foundInPayformsIndex = zRepPayforms.findIndex(payform =>
							payform.code == Number.parseInt(zRepReturnPayform.PAYFORMCD)
						);

						if(foundInPayformsIndex == -1){
							zRepPayforms.push({
								realizSum: new Decimal(0),
								returnSum: new Decimal(zRepReturnPayform.SUM),
								code: Number.parseInt(zRepReturnPayform.PAYFORMCD)
							})
						}
						else {
							zRepPayforms[foundInPayformsIndex].returnSum = new Decimal(zRepReturnPayform.SUM);
						}
					}
				}

				totalPeriodPayforms.push(...zRepPayforms);
			}
		}
		let totalPeriodPayformsReduced = [];
		for(let periodPayform of totalPeriodPayforms) {
			let foundPayformIndex = totalPeriodPayformsReduced.findIndex(payform => payform.code == periodPayform.code);
			if(foundPayformIndex == -1) {
				totalPeriodPayformsReduced.push(periodPayform)
			}
			else {
				totalPeriodPayformsReduced[foundPayformIndex].realizSum = totalPeriodPayformsReduced[foundPayformIndex].realizSum.plus(periodPayform.realizSum);

				if(periodPayform.returnSum) {
					if(totalPeriodPayformsReduced[foundPayformIndex].returnSum) {
						totalPeriodPayformsReduced[foundPayformIndex].returnSum = totalPeriodPayformsReduced[foundPayformIndex].returnSum.plus(periodPayform.returnSum);
					}
					else {
						totalPeriodPayformsReduced[foundPayformIndex].returnSum = periodPayform.returnSum;
					}
				}
			}
		}

		return totalPeriodPayformsReduced.map(payform => {
			let totalSum = payform.realizSum;

			if (payform.returnSum) {
				totalSum = totalSum.minus(payform.returnSum)
			}

			return {
				code: payform.code,
				sum: totalSum
			}
		});
	}
}