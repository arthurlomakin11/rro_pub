import {ERROClient, SettingsOptions} from "./e-rro";
import {CurrentDate} from "./functions/CurrentDate";
import {DatabaseHelper} from "./DatabaseHelper";
import {createContext, ReceiptStatus, PrismaClient, ShiftTransactionType,
	TransactionStatus, Runtime, CashServiceStatus} from "artbox_db/index.js";
const Decimal = Runtime.Decimal;
import {requestComputing} from "./request_computing";
import {xmlToJson} from "./functions/xmlToJson";
import {createTaxUrl} from "./functions/createTaxUrl";
import {countLocalBalance} from "./functions/countLocalBalance";

let PaymentTypes = {
	0: "Готівка",
	1: "Банківська картка",
	2: "Передоплата"
}

let UnitTypes = {
	"0301": "кг",
	"2009": "шт"
}

function getLocalCounterCache(cashier:any) {
	if(!LocalCountersObject[cashier.id]) {
		LocalCountersObject[cashier.id] = cashier.localCounter;
	}
	return LocalCountersObject[cashier.id];
}

function setLocalCounterCache(cashier:any, localCounter: number) {
	LocalCountersObject[cashier.id] = localCounter;
}

function createSettingsOptions(object:any):SettingsOptions {
	const signKey = object.keysAccess[0].signKey;
	return {
		host: "fs.tax.gov.ua",
		port: 8609,
		requestPath: "/fs",

		pass: signKey.password,
		role: signKey.role,

		keyPath: signKey.keyPath,
		certPath: signKey.certPath
	}
}

let RROHash = {};

let LocalCountersObject = {};

interface WorkerData {
	requestType: string,
	data: object,
	erro?: ERROClient
}

let createBackupRequestWorker = async (data:WorkerData) => {
	return requestComputing(data);
};

let checkLicenseState = (expireDate):boolean => {
	return CurrentDate.UTCDateTimeToLocal(expireDate).getTime() >= new Date().getTime()
};

let context:PrismaClient = null;

function getContext():PrismaClient {
	if(context === null) {
		context = createContext();
	}
	return context;
}

let EmptyShiftsTransactionsCounter = 0;
async function ShiftsTransactionsProcess() {
	let StartFunctionTimeout = EmptyShiftsTransactionsCounter > 50 ? 500 : 0;

	let database = new DatabaseHelper(getContext());
	let shiftTransaction = await database.getNewShiftTransaction();

	if(!shiftTransaction) {
		EmptyShiftsTransactionsCounter++;
		setTimeout(async () => await ShiftsTransactionsProcess(), StartFunctionTimeout);
		return;
	}
	else {
		EmptyShiftsTransactionsCounter = 0;
	}

	let cashier = shiftTransaction.cashier;

	if(!checkLicenseState(cashier.licenseExpireDateTime)) {
		await database.UpdateShiftTransaction(shiftTransaction.id, {
			status: TransactionStatus.Error,
			datetimeRunned: new Date(),
			errorMessage: "License expire error"
		});

		setTimeout(async () => await ShiftsTransactionsProcess(), 0);
		return;
	}

	let erro;
	if(RROHash[cashier.id]) {
		erro = RROHash[cashier.id];
	}
	else {
		erro = new ERROClient(createSettingsOptions(cashier));
	}

	let ordernum = getLocalCounterCache(cashier);

	try {
		if(shiftTransaction.type == ShiftTransactionType.ZRep) {
			let XReportWorkerData:WorkerData = {
				requestType: "CreateXReport",
				data: {
					register_number: cashier.register_number
				},
				erro: erro
			}

			const XReportAnswer = await createBackupRequestWorker(XReportWorkerData);

			if(XReportAnswer.statusCode == 200) {
				let xReportJson = XReportAnswer.data;

				let data = {
					tin: cashier.object.organization.entrepreneur.TIN,
					ipn: cashier.object.organization.entrepreneur.IPN,
					orgnm: cashier.object.organization.name,
					pointnm: cashier.object.name,
					pointaddr: cashier.object.adress,
					orderdate: CurrentDate.get_date_in_ddmmyyyy(),
					ordertime: CurrentDate.get_time_in_hhmmss(),
					ordernum: ordernum,
					cashdesknum: cashier.desk_number,
					cashregisternum: cashier.register_number,
					cashier: "Семко А.М.",
					data: XReportAnswer.data
				}

				let ZReportWorkerData:WorkerData = {
					requestType: "ZReportRequest",
					data: data,
					erro: erro
				}

				const ZReportAnswer = await createBackupRequestWorker(ZReportWorkerData);

				if(ZReportAnswer.statusCode == 200) {
					await database.UpdateShiftTransaction(shiftTransaction.id, {
						status: TransactionStatus.Done,
						datetimeRunned: new Date(),
						data: xmlToJson(ZReportAnswer.metaData),
						localBalance: countLocalBalance(xReportJson)
					});
					await database.UpdateLocalCounter(cashier.id, ordernum + 1);

					setLocalCounterCache(cashier, ordernum + 1);
				}
				else if(ZReportAnswer.data.includes('7 CheckLocalNumberInvalid')) {
					let newlocalCounter = Number.parseInt(ZReportAnswer.data.split('Номер документа повинен дорівнювати')[1]);
					setLocalCounterCache(cashier, newlocalCounter);
					await database.UpdateLocalCounter(cashier.id, newlocalCounter);
					await database.UpdateShiftTransaction(shiftTransaction.id, {
						datetimeRunned: new Date(),
						errorMessage: (
							JSON.stringify(ZReportAnswer.data.split('Номер документа повинен дорівнювати')) + "  " +
							'newlocalCounter: ' + newlocalCounter
						),
						data: xmlToJson(ZReportAnswer.metaData)
					});
				}
				else if(ZReportAnswer.data.includes('ZRepAlreadyRegistered')) {
					await database.UpdateShiftTransaction(shiftTransaction.id, {
						datetimeRunned: new Date(),
						errorMessage: "ZRepAlreadyRegistered",
						status: TransactionStatus.Done,
						data: xmlToJson(ZReportAnswer.metaData)
					})
				}
				else if(ZReportAnswer.data.includes('ShiftNotOpened')) {
					await database.UpdateShiftTransaction(shiftTransaction.id, {
						datetimeRunned: new Date(),
						errorMessage: "ShiftNotOpened",
						status: TransactionStatus.Done,
						data: xmlToJson(ZReportAnswer.metaData)
					})
				}
				else if(ZReportAnswer.data.includes('Помилка перевірки стану сертифіката підписувача на сервері КНЕДП видавця')) {
					await database.UpdateShiftTransaction(shiftTransaction.id, {
						datetimeRunned: new Date(),
						errorMessage: ZReportAnswer.data
					});
				}
				else {
					await database.UpdateShiftTransaction(shiftTransaction.id, {
						datetimeRunned: new Date(),
						errorMessage: "Error: " + ZReportAnswer.data,
						status: TransactionStatus.Error,
						data: xmlToJson(ZReportAnswer.metaData)
					});
				}
			}
			else {
				await database.UpdateShiftTransaction(shiftTransaction.id, {
					status: TransactionStatus.Error,
					datetimeRunned: new Date(),
					errorMessage: "XReport Error: " + XReportAnswer.data
				});
			}
		}
		else if(shiftTransaction.type == ShiftTransactionType.ShiftClose) {
			let data = {
				tin: cashier.object.organization.entrepreneur.TIN,
				ipn: cashier.object.organization.entrepreneur.IPN,
				orgnm: cashier.object.organization.name,
				pointnm: cashier.object.name,
				pointaddr: cashier.object.adress,
				orderdate: CurrentDate.get_date_in_ddmmyyyy(),
				ordertime: CurrentDate.get_time_in_hhmmss(),
				ordernum: ordernum,
				cashdesknum: cashier.desk_number,
				cashregisternum: cashier.register_number,
				cashier: "Семко А.М."
			}

			let workerData:WorkerData = {
				requestType: "CloseShiftRequest",
				data: data,
				erro: erro
			}

			const ShiftCloseAnswer = await createBackupRequestWorker(workerData);

			if(ShiftCloseAnswer.statusCode == 200) {
				await database.UpdateShiftTransaction(shiftTransaction.id, {
					status: TransactionStatus.Done,
					datetimeRunned: new Date()
				});
				await database.UpdateLocalCounter(cashier.id, ordernum + 1);

				setLocalCounterCache(cashier, ordernum + 1);
			}
			else if(ShiftCloseAnswer.data.includes('7 CheckLocalNumberInvalid')) {
				let newlocalCounter = Number.parseInt(ShiftCloseAnswer.data.split('Номер документа повинен дорівнювати')[1]);
				setLocalCounterCache(cashier, newlocalCounter);
				await database.UpdateLocalCounter(cashier.id, newlocalCounter);
				await database.UpdateShiftTransaction(shiftTransaction.id, {
					datetimeRunned: new Date(),
					errorMessage: (
						JSON.stringify(ShiftCloseAnswer.data.split('Номер документа повинен дорівнювати')) + "  " +
						'newlocalCounter: ' + newlocalCounter
					)
				});
			}
			else if(ShiftCloseAnswer.data.includes('ShiftNotOpened')) { // if shift must be closed, and it's already closed, set OK
				await database.UpdateShiftTransaction(shiftTransaction.id, {
					datetimeRunned: new Date(),
					errorMessage: "ShiftNotOpened",
					status: TransactionStatus.Done
				})
			}
			else if(ShiftCloseAnswer.data.includes('LastDocumentMustBeZRep')) { // if shift must be closed, and there's no Z-report, create task to create ZReport
				await database.AddHighPriorityZRepTransaction(cashier.id, shiftTransaction.priority + 1);

				await database.UpdateShiftTransaction(shiftTransaction.id, {
					datetimeRunned: new Date(),
					errorMessage: "LastDocumentMustBeZRep"
				})
			}
			else if(ShiftCloseAnswer.data.includes('Помилка перевірки стану сертифіката підписувача на сервері КНЕДП видавця')) {
				await database.UpdateShiftTransaction(shiftTransaction.id, {
					datetimeRunned: new Date(),
					errorMessage: ShiftCloseAnswer.data
				});
			}
			else {
				await database.UpdateShiftTransaction(shiftTransaction.id, {
					datetimeRunned: new Date(),
					errorMessage: "Error: " + ShiftCloseAnswer.data,
					status: TransactionStatus.Error
				});
			}
		}
		else if(shiftTransaction.type == ShiftTransactionType.ShiftOpen) {
			let data = {
				tin: cashier.object.organization.entrepreneur.TIN,
				ipn: cashier.object.organization.entrepreneur.IPN,
				orgnm: cashier.object.organization.name,
				pointnm: cashier.object.name,
				pointaddr: cashier.object.adress,
				orderdate: CurrentDate.get_date_in_ddmmyyyy(),
				ordertime: CurrentDate.get_time_in_hhmmss(),
				ordernum: ordernum,
				cashdesknum: cashier.desk_number,
				cashregisternum: cashier.register_number,
				cashier: "Семко А.М."
			}

			let workerData:WorkerData = {
				requestType: "OpenShiftRequest",
				data: data,
				erro: erro
			}

			const ShiftOpenAnswer = await createBackupRequestWorker(workerData);

			if(ShiftOpenAnswer.statusCode == 200) {
				await database.UpdateShiftTransaction(shiftTransaction.id, {
					status: TransactionStatus.Done,
					datetimeRunned: new Date()
				});
				await database.UpdateLocalCounter(cashier.id, ordernum + 1);

				setLocalCounterCache(cashier, ordernum + 1);
			}
			else if(ShiftOpenAnswer.data.includes('7 CheckLocalNumberInvalid')) {
				let newlocalCounter = Number.parseInt(ShiftOpenAnswer.data.split('Номер документа повинен дорівнювати')[1]);
				setLocalCounterCache(cashier, newlocalCounter);
				await database.UpdateLocalCounter(cashier.id, newlocalCounter);
				await database.UpdateShiftTransaction(shiftTransaction.id, {
					datetimeRunned: new Date(),
					errorMessage: (
						JSON.stringify(ShiftOpenAnswer.data.split('Номер документа повинен дорівнювати')) + "  " +
						'newlocalCounter: ' + newlocalCounter
					)
				});
			}
			else if(ShiftOpenAnswer.data.includes('ShiftAlreadyOpened')) { // if is already opened, set OK
				await database.UpdateShiftTransaction(shiftTransaction.id, {
					datetimeRunned: new Date(),
					errorMessage: "ShiftAlreadyOpened",
					status: TransactionStatus.Done
				})
			}
			else if(ShiftOpenAnswer.data.includes('Помилка перевірки стану сертифіката підписувача на сервері КНЕДП видавця')) {
				await database.UpdateShiftTransaction(shiftTransaction.id, {
					datetimeRunned: new Date(),
					errorMessage: ShiftOpenAnswer.data
				});
			}
			else {
				await database.UpdateShiftTransaction(shiftTransaction.id, {
					datetimeRunned: new Date(),
					errorMessage: "Error: " + ShiftOpenAnswer.data,
					status: TransactionStatus.Error
				});
			}
		}
		else if(shiftTransaction.type == ShiftTransactionType.ServiceOutput) {
			const zRepBalance = await database.getZRepBalance(cashier.id);

			async function getXReport() {
				let XReportWorkerData:WorkerData = {
					requestType: "CreateXReport",
					data: {
						register_number: cashier.register_number
					},
					erro: erro
				}

				const XReportAnswer = await createBackupRequestWorker(XReportWorkerData);

				if(XReportAnswer.statusCode == 200) {
					return XReportAnswer.data
				}
				else {
					throw new Error("XReport Error: " + XReportAnswer.data)
				}
			}

			const xReport = await getXReport();

			const totalBalance = new Decimal(zRepBalance).plus(countLocalBalance(xReport));

			const totalBalanceNum = totalBalance.isPositive() ? totalBalance.toNumber() : 0;

			let data = {
				tin: cashier.object.organization.entrepreneur.TIN,
				ipn: cashier.object.organization.entrepreneur.IPN,
				orgnm: cashier.object.organization.name,
				pointnm: cashier.object.name,
				pointaddr: cashier.object.adress,
				orderdate: CurrentDate.get_date_in_ddmmyyyy(),
				ordertime: CurrentDate.get_time_in_hhmmss(),
				ordernum: ordernum,
				cashdesknum: cashier.desk_number,
				cashregisternum: cashier.register_number,
				cashier: "Семко А.М.",
				sum: totalBalanceNum
			}

			let workerData:WorkerData = {
				requestType: "NewServiceOutputRequest",
				data: data,
				erro: erro
			}

			const ServiceOutputAnswer = await createBackupRequestWorker(workerData);

			if(ServiceOutputAnswer.statusCode == 200) {
				let answer_json = xmlToJson(ServiceOutputAnswer.data);

				await database.UpdateShiftTransaction(shiftTransaction.id, {
					status: TransactionStatus.Done,
					datetimeRunned: new Date(),
					data: {
						output: totalBalanceNum,
						localCounter: Number.parseInt(answer_json.TICKET.ORDERTAXNUM)
					}
				});
				await database.UpdateLocalCounter(cashier.id, ordernum + 1);

				setLocalCounterCache(cashier, ordernum + 1);
			}
			else if(ServiceOutputAnswer.data.includes('7 CheckLocalNumberInvalid')) {
				let newlocalCounter = Number.parseInt(ServiceOutputAnswer.data.split('Номер документа повинен дорівнювати')[1]);
				setLocalCounterCache(cashier, newlocalCounter);
				await database.UpdateLocalCounter(cashier.id, newlocalCounter);
				await database.UpdateShiftTransaction(shiftTransaction.id, {
					datetimeRunned: new Date(),
					errorMessage: (
						JSON.stringify(ServiceOutputAnswer.data.split('Номер документа повинен дорівнювати')) + "  " +
						'newlocalCounter: ' + newlocalCounter
					)
				});
			}
			else if(ServiceOutputAnswer.data.includes('Помилка перевірки стану сертифіката підписувача на сервері КНЕДП видавця')) {
				await database.UpdateShiftTransaction(shiftTransaction.id, {
					datetimeRunned: new Date(),
					errorMessage: ServiceOutputAnswer.data
				});
			}
			else {
				await database.UpdateShiftTransaction(shiftTransaction.id, {
					datetimeRunned: new Date(),
					errorMessage: "Error: " + ServiceOutputAnswer.data,
					status: TransactionStatus.Error
				});
			}
		}
	}
	catch (e) {
		console.log(e);
		await database.UpdateShiftTransaction(shiftTransaction.id, {
			status: TransactionStatus.Error,
			errorMessage: JSON.stringify(e)
		});
	}

	setTimeout(async () => await ShiftsTransactionsProcess(), 0);
}


let EmptyXReportsCounter = 0;
async function xReportsProcess() {
	let StartFunctionTimeout = EmptyXReportsCounter > 50 ? 200 : 0;

	let runItself = () => setTimeout(xReportsProcess, StartFunctionTimeout);

	let database = new DatabaseHelper(getContext());
	let report = await database.getNewXReport();

	if(!report) {
		EmptyXReportsCounter++;
		runItself();
		return;
	}
	else {
		EmptyXReportsCounter = 0;
	}


	let cashier = report.cashier;

	if(!checkLicenseState(cashier.licenseExpireDateTime)) {
		await database.UpdateXReport(report.id, {
			status: TransactionStatus.Error,
			data: "License expire error"
		});
		runItself();
		return;
	}

	let erro;
	if(RROHash[cashier.id]) {
		erro = RROHash[cashier.id];
	}
	else {
		erro = new ERROClient(createSettingsOptions(cashier));
	}

	let workerData:WorkerData = {
		requestType: "CreateXReport",
		data: {
			register_number: cashier.register_number
		},
		erro: erro
	}

	try {
		let answer = await createBackupRequestWorker(workerData);

		if(answer.statusCode == 200) {
			await database.UpdateXReport(report.id, {
				status: TransactionStatus.Done,
				data: answer.data
			});
		}
		else {
			console.log("Error. For cashier.id: " + cashier.id + "   object.id" + cashier.objectId + "  ", JSON.stringify(answer) + "\n\n\n");
			await database.UpdateXReport(report.id, {
				status: TransactionStatus.Error,
				data: "Error. For cashier.id: " + cashier.id + "   object.id" + cashier.objectId + "  " + JSON.stringify(answer) + "\n\n\n"
			});
		}
	}
	catch (e) {
		console.log(e);
		await database.UpdateXReport(report.id, {
			status: TransactionStatus.Error,
			data: JSON.stringify(e)
		});
	}

	runItself();
}

let EmptyNewReceiptProcess = 0;
async function newReceiptProcessV0() {
	let StartFunctionTimeout = EmptyNewReceiptProcess > 50 ? 200 : 0;

	let runItself = () => setTimeout(newReceiptProcessV0, StartFunctionTimeout);

	let database = new DatabaseHelper(getContext());

	let receipt = await database.getNewReceiptV0();
	if(!receipt) {
		EmptyNewReceiptProcess++;
		runItself();
		return;
	}
	else {
		EmptyNewReceiptProcess = 0;
	}

	let cashier = receipt.cashier;


	if(!checkLicenseState(cashier.licenseExpireDateTime)) {
		await database.UpdateReceipt(receipt.id, {
			status: ReceiptStatus.Error,
			errorMessage: "License expire error"
		});
		runItself();
		return;
	}

	if(!RROHash[cashier.id]) {
		RROHash[cashier.id] = new ERROClient(createSettingsOptions(cashier));
	}
	let erro = RROHash[cashier.id];

	let answer;

	let ordernum = getLocalCounterCache(cashier);

	let payments = receipt.payments.map((payment:any) => {
		payment.paymentTypeName = PaymentTypes[payment.paymentTypeCode]
		payment.sumString = new Decimal(payment.sum).toFixed(2);
		payment.providedString = new Decimal(payment.provided).toFixed(2);
		payment.remainsString = new Decimal(payment.remains).toFixed(2);

		return payment;
	})

	let taxes = [];
	let total_sum = new Decimal(0);


	for(let detail of receipt.receiptDetails) {
		let sum:any = new Decimal(detail.price).mul(detail.quantity);
		sum = new Decimal(sum.toFixed(2));
		total_sum = total_sum.plus(sum);
		detail.sum = new Decimal(sum);

		if(detail.taxes) {
			let detailsLetters = [];
			let exciseDetailsLetter = null;

			detail.taxes.forEach(tax => {
				tax.turnover = sum;

				if(tax.taxCode == 1) { // excise tax
					let excise_turnover = sum;
					let excise_sum = excise_turnover.dividedBy(100).mul(100 + tax.taxPercent).minus(excise_turnover);

					tax.turnover = sum.minus(excise_sum);

					let excise_tax = {
						...tax,
						turnover: excise_turnover,
						sum: excise_sum
					}
					taxes.push(excise_tax);

					exciseDetailsLetter = excise_tax.taxLetter;
				}
				else {
					tax.sum = new Decimal(tax.turnover).dividedBy(100).mul(100 + tax.taxPercent).minus(tax.turnover);

					taxes.push(tax);
					detailsLetters.push(tax.taxLetter);
				}
			})

			if(exciseDetailsLetter) {
				detailsLetters.push(exciseDetailsLetter)
			}

			detail.taxLetters = detailsLetters.join("")
		}

		detail.unitName = UnitTypes[detail.unitCode.toString()]
	}

	let reduced_taxes = [];

	for(let tax of taxes) {
		let sameTaxIndex = reduced_taxes.findIndex(reduced_tax =>
			reduced_tax.taxPercent == tax.taxPercent &&
			reduced_tax.taxLetter == tax.taxLetter &&
			reduced_tax.taxCode == tax.taxCode
		);
		if(sameTaxIndex !== -1) {
			reduced_taxes[sameTaxIndex].sum = new Decimal(reduced_taxes[sameTaxIndex].sum).plus(tax.sum);
			reduced_taxes[sameTaxIndex].turnover = new Decimal(reduced_taxes[sameTaxIndex].turnover).plus(tax.turnover);
		}
		else {
			reduced_taxes.push(tax);
		}
	}

	let reduced_taxes_finalized = reduced_taxes.map(tax => {
		tax.sum = new Decimal(tax.sum).toFixed(2);
		tax.turnover = new Decimal(tax.turnover).toFixed(2);
		tax.taxPercent = new Decimal(tax.taxPercent).toFixed(2);

		return tax;
	});

	let receipt_discount:any = null;

	if(receipt.discount.toNumber() > 0) { // скидка процент
		receipt_discount = {}
		receipt_discount.discountType = 1;
		receipt_discount.discountSum = total_sum.mul(receipt.discount.dividedBy(100));
		receipt_discount.discountPercent = new Decimal(receipt.discount);

		total_sum = total_sum.minus(receipt_discount.discountSum);
	}
	else if (receipt.extra_charge.toNumber() > 0) { // скидка сумма
		receipt_discount = {}
		receipt_discount.discountType = 0;
		receipt_discount.discountSum = receipt.extra_charge;

		total_sum = total_sum.minus(receipt_discount.discountSum);
	}

	let data = {
		tin: cashier.object.organization.entrepreneur.TIN,
		ipn: cashier.object.organization.entrepreneur.IPN,
		orgnm: cashier.object.organization.name,
		pointnm: cashier.object.name,
		pointaddr: cashier.object.adress,
		orderdate: CurrentDate.get_date_in_ddmmyyyy(),
		ordertime: CurrentDate.get_time_in_hhmmss(),
		ordernum: ordernum,
		cashdesknum: cashier.desk_number,
		cashregisternum: cashier.register_number,
		cashier: "Семко А.М.",
		checktotal_sum: total_sum,
		payments: payments,
		taxes: reduced_taxes_finalized,
		products: receipt.receiptDetails,
		discount: receipt_discount,
		returnReceipt: receipt.returnReceipt,
		returnReceiptNumber: receipt.returnReceiptNumber
	}

	let workerData:WorkerData = {
		requestType: "NewReceiptRequest",
		data: data,
		erro: erro
	}

	try {
		answer = await createBackupRequestWorker(workerData);

		if (answer.statusCode == 200) {
			await database.UpdateReceiptStatus(receipt.id, ReceiptStatus.Processing);
			await database.UpdateLocalCounter(cashier.id, ordernum + 1);

			setLocalCounterCache(cashier, ordernum + 1);

			let answer_json = xmlToJson(answer.data);

			let qrCodeUrl = createTaxUrl(cashier.register_number, answer_json.TICKET.ORDERTAXNUM, total_sum);

			await database.UpdateReceipt(receipt.id, {
				status: ReceiptStatus.Done,
				qrCodeUrl: qrCodeUrl.toString(),
				localCounter: Number.parseInt(answer_json.TICKET.ORDERTAXNUM)
			});
		}
		else if(answer.data.includes('Помилка перевірки стану сертифіката підписувача на сервері КНЕДП видавця')) {
			await database.UpdateReceipt(receipt.id, {
				errorMessage: answer.data
			});
		}
		else {
			if(answer.data.includes('7 CheckLocalNumberInvalid')) {
				console.log(JSON.stringify(answer.data.split('Номер документа повинен дорівнювати')));
				let newlocalCounter = Number.parseInt(answer.data.split('Номер документа повинен дорівнювати')[1]);
				console.log('newlocalCounter: ' + newlocalCounter);
				setLocalCounterCache(cashier, newlocalCounter);
				await database.UpdateLocalCounter(cashier.id, newlocalCounter);
			}
			else {
				await database.UpdateReceipt(receipt.id, {
					status: ReceiptStatus.Error,
					errorMessage: answer.data
				});
			}
			console.log("Error. For cashier.id: " + cashier.id + "   object.id" + cashier.objectId + "  ", answer.data + "\n\n\n");
		}
	}
	catch (e) {
		console.log("error: ", e.message + "\n\n\n");
	}

	runItself();
	return;
}

let EmptyAutomaticShiftProcessCounter = 0;
async function automaticShiftProcess() {
	let StartFunctionTimeout = 0;
	if(EmptyAutomaticShiftProcessCounter > 50) {
		StartFunctionTimeout = 300;
	}

	const runItself = () => setTimeout(automaticShiftProcess, StartFunctionTimeout);

	const database = new DatabaseHelper(getContext());
	let cashier = await database.getFirstToSheduleShiftCashier();

	if(cashier === null) {
		EmptyAutomaticShiftProcessCounter++;

		runItself();
		return;
	}
	else {
		EmptyAutomaticShiftProcessCounter = 0;
	}

	const shiftTransactionsArray = [];


	if(!cashier?.shifts.some(transaction => transaction.type == 'ZRep')) {
		shiftTransactionsArray.push({
			datetimeToRun: CurrentDate.currentDateWithCustomTime(cashier.shiftCloseTime),
			cashierId: cashier.cashierId,
			type: 'ZRep',
			status: TransactionStatus.ToCreate,
			automatic: true
		})
	}

	if(!cashier?.shifts.some(transaction => transaction.type == 'ShiftClose')) {
		shiftTransactionsArray.push({
			datetimeToRun: CurrentDate.currentDateWithCustomTime(cashier.shiftCloseTime),
			cashierId: cashier.cashierId,
			type: 'ShiftClose',
			status: TransactionStatus.ToCreate,
			automatic: true
		})
	}

	if(!cashier?.shifts.some(transaction => transaction.type == 'ShiftOpen')) {
		shiftTransactionsArray.push({
			datetimeToRun: CurrentDate.currentDateWithCustomTime(cashier.shiftOpenTime),
			cashierId: cashier.cashierId,
			type: 'ShiftOpen',
			status: TransactionStatus.ToCreate,
			automatic: true
		})
	}

	await database.addManyShiftTransactions(shiftTransactionsArray);

	runItself();
}

let EmptyShiftOutputProcessCounter = 0;
async function automaticShiftOutputProcess() {
	let StartFunctionTimeout = 0;
	if(EmptyShiftOutputProcessCounter > 50) {
		StartFunctionTimeout = 300;
	}

	const runItself = () => setTimeout(automaticShiftOutputProcess, StartFunctionTimeout);

	const database = new DatabaseHelper(getContext());
	let CashierOutputLine = await database.getFirstToSheduleShiftOutput();

	if(CashierOutputLine === null) {
		EmptyShiftOutputProcessCounter++;

		runItself();
		return;
	}
	else {
		EmptyShiftOutputProcessCounter = 0;
	}

	await database.addShiftTransaction({
		datetimeToRun: CurrentDate.currentDateWithCustomTime(CashierOutputLine.shiftOutputTime),
		cashierId: CashierOutputLine.cashierId,
		type: 'ServiceOutput',
		status: TransactionStatus.ToCreate,
		automatic: true,
		priority: 2
	} as any);

	runItself();
}

let EmptyPeriodicalReportsCounter = 0;
async function PeriodicalReportsProcess() {
	let StartFunctionTimeout = EmptyPeriodicalReportsCounter > 50 ? 300 : 0;

	let runItself = () => setTimeout(PeriodicalReportsProcess, StartFunctionTimeout);

	const database = new DatabaseHelper(getContext());
	let periodicalReport = await database.getFirstPeriodicalReport();
	if(!periodicalReport) {
		EmptyPeriodicalReportsCounter++;
		runItself();
		return;
	}
	else {
		EmptyPeriodicalReportsCounter = 0;
	}

	let cashier = periodicalReport.cashier;

	try {
		let erro = new ERROClient(createSettingsOptions(cashier));
		let report = await createBackupRequestWorker({
			requestType: 'GetShortPeriodicalReportRequest',
			erro: erro,
			data: {
				cashregisternum: cashier.register_number,
				periodStartDate: periodicalReport.periodStartDate,
				periodEndDate: periodicalReport.periodEndDate
			}
		});

		await database.UpdatePeriodicalReport(periodicalReport.id, {
			status: TransactionStatus.Done,
			data: report
		});
	}
	catch(e) {
		await database.UpdatePeriodicalReport(periodicalReport.id, {
			status: TransactionStatus.Error,
			errorMessage: e.message
		});
	}

	runItself();
	return;
}


let EmptyNewServiceProcess = 0;
async function newServiceProcess() {
	let StartFunctionTimeout = EmptyNewServiceProcess > 50 ? 200 : 0;

	let runItself = () => setTimeout(newServiceProcess, StartFunctionTimeout);

	let database = new DatabaseHelper(getContext());

	let service = await database.getNewService();

	if(!service) {
		EmptyNewServiceProcess++;
		runItself();
		return;
	}
	else {
		EmptyNewServiceProcess = 0;
	}

	let cashier = service.cashier;

	if(!checkLicenseState(cashier.licenseExpireDateTime)) {
		await database.UpdateService(service.id, {
			status: CashServiceStatus.Error,
			errorMessage: "License expire error"
		});
		runItself();
		return;
	}

	if(!RROHash[cashier.id]) {
		RROHash[cashier.id] = new ERROClient(createSettingsOptions(cashier));
	}
	let erro = RROHash[cashier.id];

	let answer;

	let ordernum = getLocalCounterCache(cashier);

	let data = {
		tin: cashier.object.organization.entrepreneur.TIN,
		ipn: cashier.object.organization.entrepreneur.IPN,
		orgnm: cashier.object.organization.name,
		pointnm: cashier.object.name,
		pointaddr: cashier.object.adress,
		orderdate: CurrentDate.get_date_in_ddmmyyyy(),
		ordertime: CurrentDate.get_time_in_hhmmss(),
		ordernum: ordernum,
		cashdesknum: cashier.desk_number,
		cashregisternum: cashier.register_number,
		cashier: "",
		sum: service.sum,
	}

	let workerData:WorkerData;
	if(service.sum.toNumber() > 0) { // Службове внесення
		workerData = {
			requestType: "NewServiceInputRequest",
			data: data,
			erro: erro
		}
	}
	else if(service.sum.toNumber() < 0) { // Службова видача
		workerData = {
			requestType: "NewServiceOutputRequest",
			data: data,
			erro: erro
		}
	}

	try {
		answer = await createBackupRequestWorker(workerData);

		if(answer.statusCode == 200) {
			await database.UpdateServiceStatus(service.id, CashServiceStatus.Processing);
			await database.UpdateLocalCounter(cashier.id, ordernum + 1);

			let answer_json = xmlToJson(answer.data);

			let qrCodeUrl = createTaxUrl(cashier.register_number, answer_json.TICKET.ORDERTAXNUM, service.sum);

			await database.UpdateService(service.id, {
				status: CashServiceStatus.Done,
				qrCodeUrl: qrCodeUrl.toString()
			});

			setLocalCounterCache(cashier, ordernum + 1);
		}
		else if(answer.data.includes('Помилка перевірки стану сертифіката підписувача на сервері КНЕДП видавця')) {
			await database.UpdateService(service.id, {
				errorMessage: answer.data
			});
		}
		else if(answer.data.includes('7 CheckLocalNumberInvalid')) {
			console.log(JSON.stringify(answer.data.split('Номер документа повинен дорівнювати')));
			let newlocalCounter = Number.parseInt(answer.data.split('Номер документа повинен дорівнювати')[1]);
			console.log('newlocalCounter: ' + newlocalCounter);
			setLocalCounterCache(cashier, newlocalCounter);
			await database.UpdateLocalCounter(cashier.id, newlocalCounter);
		}
		else {
			await database.UpdateService(service.id, {
				status: CashServiceStatus.Error,
				errorMessage: answer.data
			});
		}
	}
	catch (e) {
		await database.UpdateService(service.id, {
			status: CashServiceStatus.Error,
			errorMessage: e.message
		});
	}

	runItself();
}


const startAsyncTasks = tasksArray => {
	for(const task of tasksArray) {
		(async () => await task())();
	}
}

function startAsyncTasksFunction() {
	startAsyncTasks([
		xReportsProcess,
		ShiftsTransactionsProcess,
		newServiceProcess,
		newReceiptProcessV0,
		PeriodicalReportsProcess,
	]);


	// startAsyncTasks([automaticShiftProcess, automaticShiftOutputProcess]);
}

startAsyncTasksFunction();