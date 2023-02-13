import { Runtime } from "artbox_db/index.js";
import {ShiftTotalsPayForm} from "../interfaces";
const Decimal = Runtime.Decimal;

export function countLocalBalance(XReport:any) {
	if(XReport && XReport.Totals) {
		let totalSum = new Decimal(0);

		totalSum = totalSum.plus(XReport.Totals.ServiceInput)
		totalSum = totalSum.minus(XReport.Totals.ServiceOutput)

		if(XReport.Totals.Real && XReport.Totals.Real.PayForm) {
			const sum = sumCashPayForms(XReport.Totals.Real.PayForm)
			totalSum = totalSum.plus(sum);
		}

		if(XReport.Totals.Ret && XReport.Totals.Ret.PayForm) {
			const sum = sumCashPayForms(XReport.Totals.Ret.PayForm)
			totalSum = totalSum.minus(sum);
		}

		return totalSum.toNumber();
	}
	else {
		return 0;
	}
}


function sumCashPayForms(payforms: ShiftTotalsPayForm[]) {
	const cashPayForms = payforms.filter(payform => {
		return Number.parseInt(payform.PayFormCode) == 0
	}) // filter only cash

	console.log(cashPayForms);

	const cashPayFormsDecimal:any = cashPayForms.map(payform => {
		payform.Sum = new Decimal(payform.Sum) as any;
		return payform
	}) // transform string to Decimal

	if(cashPayFormsDecimal.length > 0) {
		const sumPayform = cashPayFormsDecimal.reduce((payform_f, payform_s) => {
			return {
				Sum: payform_f.plus(payform_s)
			}
		})

		return sumPayform ? sumPayform.Sum : new Decimal(0);
	}
	return new Decimal(0);
}