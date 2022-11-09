/* eslint-disable array-callback-return */
// Imports
import React, { useState, useEffect } from 'react';
import { useFetch } from '../Helpers/API'
import { useMSAL } from '../Helpers/MSAL';
import { useMsal } from '@azure/msal-react';
import { Button } from '@material-ui/core';
import { confirmAlert } from 'react-confirm-alert';
import UserService from '../Services/User'
import CircularProgress from '@mui/material/CircularProgress';

const settings = require('../settings.json')

function HomePage(props) {
    // States, Constants, and MSAL
    const APILink = `${settings.APIBase}/home/user`
    const { loading, data = [] } = useFetch(APILink, 0)
    const { token, tokenLoading } = useMSAL()
    const { accounts } = useMsal()
    const [isGettingDiscrepancy, setIsGettingDiscrepancy] = useState(false)
    const [tasks, setTasks] = useState([])

    // --- Effects --- //
    useEffect(() => { // Gets the tasks from Microsoft Planner
        async function getTasks() {
            let d = await fetch(`${settings.graphUrl}/me/planner/tasks`, { headers: { 'Authorization': `Bearer ${token}` } })
                .then(re => re.json())
                .catch(er => console.warn(er.text()))
            setTasks(d.value)
        }
        if (token) getTasks()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token])


    // --- Functions --- //

    // Prompts for confirmation before checking all discrepancies if all was chosen, otherwise just checks the user
    const handleDiscrepancyCheck = async (all = false) => {
        if (all) {
            confirmAlert({
                customUI: ({ onClose }) => {
                    return (
                        <div className='confirm-alert'>
                            <h1>Confirm Action</h1>
                            <br />
                            <p>Checking all discrepancies will send every extra notifications on top of the automtically scheduled checks at 11:45am and 4:45pm. Avoid sending too many notifications to users.</p>
                            <span style={{ margins: '1rem' }}>
                                <Button variant='contained' color='primary' size='large' style={{ margin: '1rem', backgroundColor: localStorage.getItem('accentColor') || '#00c6fc67' }} onClick={() => {
                                    UserService.discrepancyCheckAll(token)
                                    onClose()
                                }}
                                >Confirm</Button>
                                <Button variant='contained' color='primary' size='large' style={{ backgroundColor: '#fc0349', margin: '1rem' }} onClick={() => {
                                    onClose()
                                }}>Nevermind</Button>
                            </span>
                        </div>
                    )
                }
            })
        } else {
            setIsGettingDiscrepancy(true)
            let res = await UserService.discrepancyCheck(token)
            if (!res.error) alert(`${res.data.count} Discrepancies Found`)
            else alert(`Error when checking discrepancies. Report this to Thomas C`)
            setIsGettingDiscrepancy(false)
        }
    }

    // --- Render --- //
    function renderStatsData(k, v) {
        if (k === 'Daily Dollars' && (!props.permissions || !props.permissions.view_reports) && !props.isAdmin) return <></>
        return <div key={k} className='UserReport' style={{ cursor: 'default', background: k === 'Daily Dollars' ? parseInt(v) / 650 < 1 ? `linear-gradient(90deg, ${localStorage.getItem('accentColor') || '#e67c52'} 0%, ${blendColors(localStorage.getItem('accentColor') || '#00c6fc67', '#1b1b1b', .9)} ${parseInt(v) / 650 * 100 || 0}%, #1b1b1b 100%)` : localStorage.getItem('accentColor') || '#00c6fc67' : '#1b1b1b67' }}>
            <h1 style={{ float: 'left' }}>{k.replace('ppd_', '').replace('hrly_', '')}</h1>
            <h1 style={{ float: 'right' }}>{k === 'Daily Dollars' ? `$${v}` : `${v.is_hourly ? `${v.count} ${v.count > 1 ? `hours` : `hour`}` : `${v.count}`}`}</h1>
        </div >
    }

    function renderTasks(row) {
        let created = new Date(row.createdDateTime)
        let due = new Date(row.dueDateTime)
        let now = new Date()
        let background = localStorage.getItem('accentColor') || '#00c6fc67'
        if (row.dueDateTime && (due.getMonth() < now.getMonth() || due.getDate() < now.getDate())) background = '#a33c00e2'
        if (row.percentComplete) background = `linear-gradient(90deg, ${localStorage.getItem('accentColor') || '#e67c52'} 0%, ${blendColors(localStorage.getItem('accentColor') || '#e67c52', '#1b1b1b', .9)} ${row.percentComplete}%, #1b1b1b 100%)`
        return <div key={row.id} className='UserReport' style={{ background: background, cursor: 'default' }}>
            <h1 style={{ float: 'left' }}>{row.title}</h1>
            <h1 style={{ float: 'right', textAlign: 'right' }}>Created: {1 + created.getMonth()}-{created.getDate()}{row.dueDateTime ? `, Due: ${1 + due.getMonth()}-${due.getDate()}` : ''}</h1>
        </div >
    }

    // Returns blank page if data is loading
    if (loading || tokenLoading) return <></>
    else return (
        <div>
            <div className='AssetArea'>
                <div className='UserReports'>
                    <h1 style={{ textDecoration: 'underline', padding: '1rem', paddingTop: '2rem' }}>To Do</h1>
                    {tasks.length > 0 ?
                        tasks.filter(task => !(task.completedBy || (accounts.length && task.title.toLowerCase().includes(accounts[0].name.split(' ')[0].toLowerCase())))).map(m => { if (!m.completedBy) return renderTasks(m) })
                        : <CircularProgress size='48px' />}
                </div>
                <div className='UserReports'>
                    <h1 style={{ textDecoration: 'underline', padding: '1rem', paddingTop: '2rem' }}>Daily Statistics</h1>
                    {props.isAdmin || (props.permissions && props.permissions.use_discrepancy_check) ?
                        <Button variant='contained' disabled={isGettingDiscrepancy} style={{ margin: '1rem', backgroundColor: localStorage.getItem('accentColor') || '#00c6fc67' }} size='large' onClick={() => handleDiscrepancyCheck()}>Check For Discrepancies</Button>
                        : undefined}
                    {props.isAdmin || (props.permissions && props.permissions.use_all_discrepancy_check) ?
                        <Button variant='contained' disabled={isGettingDiscrepancy} style={{ margin: '1rem', backgroundColor: localStorage.getItem('accentColor') || '#00c6fc67' }} size='large' onClick={() => handleDiscrepancyCheck(true)}>Check For All Discrepancies</Button>
                        : undefined}
                    {Object.keys(data).map(m => renderStatsData(m, data[m]))}
                </div>
            </div>
        </div>
    )
}

export default HomePage

/**
 * Averages R,G, and B values of two colors
 * @param {String} colorA 
 * @param {String} colorB 
 * @param {Number} amount Blend amount
 * @returns 
 */
function blendColors(colorA, colorB, amount) {
    const [rA, gA, bA] = colorA.match(/\w\w/g).map((c) => parseInt(c, 16));
    const [rB, gB, bB] = colorB.match(/\w\w/g).map((c) => parseInt(c, 16));
    const r = Math.round(rA + (rB - rA) * amount).toString(16).padStart(2, '0');
    const g = Math.round(gA + (gB - gA) * amount).toString(16).padStart(2, '0');
    const b = Math.round(bA + (bB - bA) * amount).toString(16).padStart(2, '0');
    return '#' + r + g + b;
}