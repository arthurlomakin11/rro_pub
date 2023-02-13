export function createTaxUrl(cashierRegesterNumber:string, orderTaxNumber:string, totalSum:any) {
	let qrCodeUrl = new URL("https://cabinet.tax.gov.ua/cashregs/check")
	qrCodeUrl.searchParams.append('fn', cashierRegesterNumber)
	qrCodeUrl.searchParams.append('id', orderTaxNumber)
	qrCodeUrl.searchParams.append("sm", totalSum.toString())

	return qrCodeUrl
}