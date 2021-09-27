import React from 'react';
import PageTemplate from './Template'
import { useState, useEffect } from 'react';
import { useFetch } from '../Helpers/API';
import SelectSearch, { fuzzySearch } from 'react-select-search';
import hourlyService from '../Services/Hourly'
import { useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError } from '@azure/msal-common';
import TimeKeeper from 'react-timekeeper';
import '../css/Hourly.css';
const settings = require('../settings.json')

/*
 *  time on click, set style display to show the clock 
 * 
 */




function HourlyPage() {
    const { instance, accounts } = useMsal()
    let APILink = `${settings.APIBase}/hourly/user/`
    const [date, setDate] = useState(Date.now())
    const [jobCodes, setJobCodes] = useState(null);
    const [newJobCode, setNewJobCode] = useState(0);
    const [newComment, setNewComment] = useState('');
    const { loading, data = [], setData } = useFetch(APILink.concat(getDate(date)), null)
    const [times, setTimes] = useState({})
    async function getTokenSilently() {
        const SilentRequest = { scopes: ['User.Read'], account: instance.getAccountByLocalId(accounts[0].localAccountId), forceRefresh: true }
        let res = await instance.acquireTokenSilent(SilentRequest)
            .catch(async er => {
                if (er instanceof InteractionRequiredAuthError) {
                    return await instance.acquireTokenPopup(SilentRequest)
                } else {
                    console.log('Unable to get token')
                }
            })
        return res.accessToken
    }


    useEffect(() => {
        async function getJobCodes() {
            const response = await fetch(`${settings.APIBase}/job/all`, {
                mode: 'cors',
                headers: {
                    'Access-Control-Allow-Origin': '*'
                }
            });
            const data = await response.json();
            setJobCodes(data.job_codes)
        }
        getJobCodes()
    }, [])

    const handleDateChange = () => {
        setDate(document.getElementById('date_selector').value)
    }

    const handleTextInputChange = async (id, e, target = false) => {
        if (target) {
            document.getElementById(`${id}-${target.split('-')[1] === 'start' ? 'Start' : 'End'}`)
        } else if (e && isNaN(parseInt(e))) { //checks to make sure e is real, not an int from select
            if (e.target.classList.contains('invalid')) e.target.classList.remove('invalid')
        } else { //remove invalid from new job code input
            document.getElementById('new-jobcode').classList.remove('invalid')
        }
        if (id === 'new') {
            let dateString = new Date(date).toISOString().split('T')[0]
            let job_code = newJobCode;
            if (!isNaN(parseInt(e))) { setNewJobCode(parseInt(e)); job_code = parseInt(e) }
            let dateInfo = times.new
            let comment = newComment;
            if (e && e.target) switch (e.target.id) {
                case 'new-notes':
                    comment = e.target.value
                    await setNewComment(e.target.value)
                    break;
                default:
                    console.log('Default Case hit for new')
                    return
            }

            // ----------------
            // Data validation
            // ----------------

            // Check to see if date is added
            if (!dateInfo) {
                document.getElementById('new-Start').classList.add('invalid')
                document.getElementById('new-End').classList.add('invalid')
                return
            }
            if (!dateInfo.startTime) return document.getElementById('new-Start').classList.add('invalid')
            if (!dateInfo.endTime) return document.getElementById('new-End').classList.add('invalid')

            // Make sure the end date is after start date
            // Parses the date as a number for simple conversion for time savings. More in depth methods used below for getting actual times
            if (parseInt(dateInfo.startTime.replace(':', '')) > parseInt(dateInfo.endTime.replace(':', ''))) return document.getElementById('new-End').classList.add('invalid')


            let total_hours = getTotalHours(dateInfo.startTime, dateInfo.endTime)
            if (total_hours < 0) return document.getElementById('new-End').classList.add('invalid')

            // Return if no job code provided
            // This will be reached if date is done before job code
            if (!job_code) return document.getElementById('new-jobcode').getElementsByTagName('input')[0].classList.add('invalid')


            //send to api
            let formData = {
                date: dateString,
                job_code: job_code,
                startTime: dateInfo.startTime,
                endTime: dateInfo.endTime,
                total_hours,
                notes: comment,
            }
            let token = await getTokenSilently()
            let res = await hourlyService.add(formData, token)
            if (res.isErrored) {
                document.getElementById('new-assetid').classList.add('invalid')
            } else {
                const response = await fetch(APILink.concat(getDate(date)), {
                    mode: 'cors',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Access-Control-Allow-Origin': '*'
                    }
                });
                const d = await response.json();
                console.log(d)
                document.getElementById('new-notes').value = ''
                setData(d);
                setNewComment('')
                let temp = { ...times }
                delete temp.new
                setTimes(temp)
                document.getElementById('new-Start').classList.remove('invalid')
                document.getElementById('new-End').classList.remove('invalid')
            }
        } else for (let i of data.records) {
            // eslint-disable-next-line eqeqeq
            if (id == i.id) {
                let formData = {
                    id: i.id,
                    change: null,
                    value: null,
                    total_hours: null
                }

                //find change
                if (target) {
                    formData.change = target.split('-')[1]
                    let dateInfo = times[id]
                    if (formData.change === 'start') formData.value = dateInfo.startTime
                    else formData.value = dateInfo.endTime
                    let total_hours = getTotalHours(dateInfo.startTime, dateInfo.endTime)
                    if (total_hours < 0) return document.getElementById(`${id}-${formData.change === 'start' ? 'Start' : 'End'}`).classList.add('invalid')
                    formData.total_hours = total_hours
                } else {
                    if (!isNaN(parseInt(e))) {
                        formData.change = 'job'
                        formData.value = parseInt(e)
                    } else {
                        if (e.target.value !== i.notes) {
                            formData.change = 'notes'
                            formData.value = e.target.value
                        }
                    }
                }

                if (!formData.change) return console.log('exited on change because no formData.change')
                let token = await getTokenSilently()
                let res = await hourlyService.edit(formData, token)
                if (res.isErrored) {
                    if (target) {
                        document.getElementById(`${id}-${formData.change === 'start' ? 'Start' : 'End'}`).classList.add('invalid')
                    } else e.target.classList.add('invalid')
                }
            }
        }
    }

    const handleKeyDown = async (id, e) => {
        if (e.key === 'Enter') handleTextInputChange(id, e)
    }

    const handleDelete = async (id, e) => {
        let token = await getTokenSilently()
        let res = await hourlyService.delete(id, getDate(date), token)
        const response = await fetch(APILink.concat(getDate(date)), {
            mode: 'cors',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Access-Control-Allow-Origin': '*'
            }
        });
        const d = await response.json();
        setData(d);

        if (res.isErrored) {
            e.target.classList.add('invalid')
        } else {
            let row = document.getElementById(`${id}-row`)
            if (row) row.remove()
        }
    }

    const getJobArray = () => {
        let ar = []
        for (let i of jobCodes) {
            //if (!i.is_hourly) continue
            ar.push({ name: i.job_code, value: i.id })
        }
        return ar
    }

    const handleTimeSelectChange = async (id, isStart, e) => {
        let sendToAPI = false
        if (id === 'new')
            if (times.new) {
                //update 'new' time
                let temp = { ...times }
                if (isStart) temp.new.startTime = e.formatted24
                else temp.new.endTime = e.formatted24
                setTimes(temp)
            } else {
                //create 'new'
                let time = { startTime: null, endTime: null }
                if (isStart) time.startTime = e.formatted24
                else time.endTime = e.formatted24
                let temp = { ...times }
                temp['new'] = time
                setTimes(temp)
            }
        else {
            //update 'id' time
            let temp = { ...times }
            if (isStart) temp[`${id}`].startTime = e.formatted24
            else temp[`${id}`].endTime = e.formatted24
            setTimes(temp)
            sendToAPI = true
        }

        if (sendToAPI) {
            let target = `${id}-${isStart ? 'start' : 'end'}`
            handleTextInputChange(id, null, target)
        }
    }

    const parseTime = () => {
        let temp = { ...times }
        for (let row of data.records) {
            let time = { startTime: row.start_time.substr(11, 5), endTime: row.end_time.substr(11, 5) }
            temp[row.id] = time
        }
        setTimes(temp)
    }
    /**
     * Function to control rendering of data
     * 
     */
    function RenderRow(row) {
        if (data.records.length > Object.keys(times).length) parseTime()
        return (<tr id={`${row.id}-row`}>
            <td>
                <SelectSearch
                    options={getJobArray()}
                    search
                    placeholder="Job Code"
                    value={row.job_code}
                    filterOptions={fuzzySearch}
                    className='job_list'
                    autoComplete='on'
                    onChange={e => handleTextInputChange(row.id, e)}
                    id={`${row.id}-jobcode`}
                />
            </td>
            <td><div className="TimeKeeper Minimized-Time" id={`${row.id}-Start`} >.
                <TimeKeeper
                    coarseMinutes='15'
                    time={row.start_time.substr(11, 5)}
                    forceCoarseMinutes closeOnMinuteSelect switchToMinuteOnHourDropdownSelect switchToMinuteOnHourSelect
                    onChange={e => handleTimeSelectChange(`${row.id}`, true, e)}
                /></div></td>
            <td><div className="TimeKeeper Minimized-Time" id={`${row.id}-End`} >.
                <TimeKeeper
                    coarseMinutes='15'
                    time={row.end_time.substr(11, 5)}
                    forceCoarseMinutes closeOnMinuteSelect switchToMinuteOnHourDropdownSelect switchToMinuteOnHourSelect
                    onChange={e => handleTimeSelectChange(`${row.id}`, false, e)}
                /></div></td>
            <td>
                <input type='text'
                    defaultValue={row.notes ? row.notes : ''}
                    className='notes'
                    id={`${row.id}-notes`}
                    style={{ width: '79%' }}
                    onBlur={e => handleTextInputChange(row.id, e)}
                    onKeyDown={e => handleKeyDown(row.id, e)} />
                <i className="material-icons delete-icon"
                    onClickCapture={e => handleDelete(row.id, e)}
                    style={{ marginBottom: '-.5rem' }}>
                    delete_outline</i>
            </td>
        </tr >)
    }


    console.log(times)
    //returns blank page if data is loading
    if (loading || !data || !jobCodes) return <PageTemplate highLight='2' />
    else return (
        <>
            <input type='date' className='date' id='date_selector' value={getDate(date)} onChange={handleDateChange} />
            <div className='assetarea'>
                <table className='rows'>
                    <thead>
                        <tr>
                            <th>Job Code</th>
                            <th className='TimeColumn'>Start Time</th>
                            <th className='TimeColumn'>End Time</th>
                            <th>Comments</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.records ? data.records.map(m => RenderRow(m)) : <></>}
                        <tr>
                            <td>
                                <SelectSearch
                                    options={getJobArray()}
                                    search
                                    placeholder="Job Code"
                                    filterOptions={fuzzySearch}
                                    className='job_list'
                                    autoComplete='on'
                                    onChange={e => handleTextInputChange('new', e)}
                                    id='new-jobcode'
                                />
                            </td>
                            <td><div className="TimeKeeper" id='new-Start'>.
                                <TimeKeeper
                                    time={times.new ? times.new.startTime ? times.new.startTime : Date.now() : Date.now()}
                                    coarseMinutes='15'
                                    forceCoarseMinutes closeOnMinuteSelect switchToMinuteOnHourDropdownSelect switchToMinuteOnHourSelect
                                    onChange={e => handleTimeSelectChange('new', true, e)}
                                    doneButton={(newTime) => (
                                        <div style={{ textAlign: 'center', padding: '9px 0', backgroundColor: '#141414a6' }} onClickCapture={e => handleTextInputChange('new', null, 'new-start')}>
                                            <i className="material-icons">done</i>
                                        </div>
                                    )}
                                /></div></td>
                            <td><div className="TimeKeeper" id='new-End'>.
                                <TimeKeeper
                                    time={times.new ? times.new.endTime ? times.new.endTime : Date.now() : Date.now()}
                                    coarseMinutes='15'
                                    forceCoarseMinutes closeOnMinuteSelect switchToMinuteOnHourDropdownSelect switchToMinuteOnHourSelect
                                    onChange={e => handleTimeSelectChange('new', false, e)}
                                    doneButton={(newTime) => (
                                        <div style={{ textAlign: 'center', padding: '9px 0', backgroundColor: '#141414a6' }} onClickCapture={e => handleTextInputChange('new', null, 'new-start')}>
                                            <i className="material-icons">done</i>
                                        </div>
                                    )}
                                /></div></td>
                            <td><input type='text' className='notes' id={`new-notes`} onBlur={(e) => handleTextInputChange('new', e)} onKeyDown={e => handleKeyDown('new', e)}></input></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <PageTemplate highLight='2' />
        </>
    )
}

export default HourlyPage

/**
 * 
 * @param {Date} date 
 * @returns 
 */
function getDate(date) {
    date = new Date(date)
    return date.toISOString().split('T')[0]
}

/**
 * 
 * @param {String} startTime 
 * @param {String} endTime 
 */
function getTotalHours(startTime, endTime) {
    // Get total hours from start and end date
    // Split the times into hours and minutes
    let total_hours = 0
    let startHour, endHour, startMinute, endMinute
    let t = startTime.split(':')
    startHour = t[0]
    startMinute = t[1]
    t = endTime.split(':')
    endHour = t[0]
    endMinute = t[1]

    // end - start
    // if start minute > end minute, carry over 60 from the hour and subtract
    if (startMinute > endMinute) {
        endMinute += 60;
        endHour--;
    }
    // Add the hours to total
    total_hours += endHour - startHour;

    // End minutes - start minutes
    t = endMinute - startMinute;
    /*
    Say 45min - 30min
    15 min needs to go to .25
    Divide by 15 to get the 15 minute intervals, and multiply by .25 to get the fraction
    */
    t = Math.round(t / 15) * .25
    //add that to total hours
    total_hours += t;
    return total_hours
}