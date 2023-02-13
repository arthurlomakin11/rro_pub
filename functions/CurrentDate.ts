export class CurrentDate {
    static get_date_in_ddmmyyyy(){
        const datetime_now = new Date()
        const year_now = datetime_now.getFullYear().toString().padStart(4, "0")
        const month_now = (datetime_now.getMonth() + 1).toString().padStart(2, "0") // отчет месяцев идет с 0, нужно прибавить 1
        const day_now = datetime_now.getDate().toString().padStart(2, "0") // padStart - добавить нули, если надо
        return day_now + month_now + year_now
    }

    static get_time_in_hhmmss() {
        const datetime_now = new Date()
        const hours_now = datetime_now.getHours().toString().padStart(2, "0")
        const minutes_now = datetime_now.getMinutes().toString().padStart(2, "0")
        const seconds_now = datetime_now.getSeconds().toString().padStart(2, "0")
        return hours_now + minutes_now + seconds_now
    }

    static getTimeZoneOffset() {
        return -(new Date().getTimezoneOffset() / 60) // getTimezoneOffset is -2 or -3 for Ukraine
    }

    static stringToTime(timeString:string):Date {
        let time = new Date('01 Jan 1970 ' + timeString + " GMT+0" + this.getTimeZoneOffset() + "00");
        return time;
    }

    static DateAddTimezoneOffset(date:Date):Date {
        date.setHours(date.getHours() + this.getTimeZoneOffset());
        return date;
    }

    static currentDateWithCustomTime(timeString:string):Date {
        let newDateTime = new Date();
        const time_parsed = CurrentDate.stringToTime(timeString);
        newDateTime.setHours(
            time_parsed.getHours() + this.getTimeZoneOffset(),
            time_parsed.getMinutes(),
            time_parsed.getSeconds(),
            time_parsed.getMilliseconds()
        );
        console.log("newDateTime.getUTCDate()" + newDateTime.getUTCDate())
        console.log("newDateTime.getUTCHours() " + newDateTime.getUTCHours())

        console.log("time_parsed" + time_parsed.toString())
        console.log("newDateTime" + newDateTime.toString())
        console.log("time_parsed.getUTCHours() " + time_parsed.getUTCHours())
        console.log("time_parsed.getHours() " + time_parsed.getHours())
        console.log("CurrentDate.getTimeZoneOffset() " + CurrentDate.getTimeZoneOffset())
        console.log("time_parsed.getDate() " + time_parsed.getDate())
        console.log("time_parsed.getUTCDate() " + time_parsed.getUTCDate())

        return newDateTime;
    }

    static UTCDateTimeToLocal(datetime:Date):Date {
        datetime.setUTCHours(datetime.getUTCHours() - CurrentDate.getTimeZoneOffset())
        return datetime;
    }
}