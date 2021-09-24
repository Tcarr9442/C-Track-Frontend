import React from 'react';
import PageTemplate from './Template'
import { useState, useEffect } from 'react';
import { useFetch } from '../Helpers/API';
import SelectSearch, { fuzzySearch } from 'react-select-search';
import assetService from '../Services/Asset'
import { useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError } from '@azure/msal-common';
import '../css/Asset.css'
const settings = require('../settings.json')

function AssetPage() {
    const { instance, accounts } = useMsal()
    let APILink = `${settings.APIBase}/asset/user/`
    const [date, setDate] = useState(Date.now())
    const [jobCodes, setJobCodes] = useState(null);
    const [newJobCode, setNewJobCode] = useState(0);
    const [newAssetTag, setNewAssetTag] = useState('');
    const [newComment, setNewComment] = useState('');
    const { loading, data = [], setData } = useFetch(APILink.concat(getDate(date)), null)
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

    const handleTextInputChange = async (id, e) => {
        if (isNaN(parseInt(e))) { //checks to make sure e is real, not an int from select
            if (e.target.classList.contains('invalid')) e.target.classList.remove('invalid')
        }
        if (id === 'new') {
            let dateString = new Date(date).toISOString().split('T')[0]
            let job_code = newJobCode;
            let asset = newAssetTag;
            let comment = newComment;
            if (!isNaN(parseInt(e))) { setNewJobCode(parseInt(e)); job_code = parseInt(e) }
            else switch (e.target.id) {
                case 'new-notes':
                    comment = e.target.value
                    await setNewComment(e.target.value)
                    break;
                case 'new-assetid':
                    asset = e.target.value
                    await setNewAssetTag(e.target.value)
                    break;
                default:
                    console.log('Default Case hit for new')
                    return
            }

            //data validation
            let cont = true;
            if (!job_code) {
                document.getElementById('new-jobcode').getElementsByTagName('input')[0].classList.add('invalid')
                cont = false
            }
            if (!asset) {
                document.getElementById('new-assetid').classList.add('invalid')
                cont = false
            }
            if (!cont) return

            //send to api
            let formData = {
                date: dateString,
                job_code: job_code,
                asset_id: asset,
                notes: comment,
            }
            let token = await getTokenSilently()
            let res = await assetService.add(formData, token)
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
                document.getElementById('new-assetid').value = ''
                document.getElementById('new-notes').value = ''
                setData(d);
                setNewComment('')
                setNewAssetTag('')
            }
        } else for (let i of data.records) {
            if (id === i.id) {
                //data validation
                let formData = {
                    id: i.id,
                    change: null
                }
                if (!isNaN(parseInt(e))) {
                    formData.change = 'job'
                    formData.value = parseInt(e)
                }
                else switch (e.target.className) {
                    case 'asset_id':
                        if (e.target.value !== i.asset_id) if (e.target.value) formData.change = 'asset'
                        break;
                    case 'notes':
                        if (e.target.value !== i.notes) formData.change = 'notes'
                        break;
                    default:
                        break;
                }

                if (!formData.change) return

                if (!formData.value) formData.value = e.target.value

                //send to api
                let token = await getTokenSilently()
                let res = await assetService.edit(formData, token)
                if (res.isErrored) {
                    e.target.classList.add('invalid')
                }
            }
        }
    }

    const handleKeyDown = async (id, e) => {
        if (e.key === 'Enter') handleTextInputChange(id, e)
    }

    const handleDelete = async (id, e) => {
        let token = await getTokenSilently()
        let res = await assetService.delete(id, getDate(date), token)
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
            //if (i.is_hourly) continue
            ar.push({ name: i.job_code, value: i.id })
        }
        return ar
    }

    /**
     * Function to control rendering of data
     * 
     */
    function RenderRow(row) {
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
            <td><input type='text' defaultValue={row.asset_id} className='asset_id' id={`${row.id}-assetid`} onBlur={e => handleTextInputChange(row.id, e)} onKeyDown={e => handleKeyDown(row.id, e)}></input></td>
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
                    style={{ marginBottom: '-0.4rem' }}>
                    delete_outline</i>
            </td>
        </tr >)
    }



    //returns blank page if data is loading
    if (loading || !data || !jobCodes) return <PageTemplate highLight='1' />
    else return (
        <>
            <input type='date' className='date' id='date_selector' value={getDate(date)} onChange={handleDateChange} />
            <div className='assetarea'>
                <table className='rows'>
                    <thead>
                        <tr>
                            <th>Job Code</th>
                            <th>Asset Tag</th>
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
                            <td><input type='text' className='asset_id' id={`new-assetid`} onBlur={(e) => handleTextInputChange('new', e)} onKeyDown={e => handleKeyDown('new', e)}></input></td>
                            <td><input type='text' className='notes' id={`new-notes`} onBlur={(e) => handleTextInputChange('new', e)} onKeyDown={e => handleKeyDown('new', e)}></input></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <PageTemplate highLight='1' />
        </>
    )
}

export default AssetPage

/**
 * 
 * @param {Date} date 
 * @returns 
 */
function getDate(date) {
    date = new Date(date)
    return date.toISOString().split('T')[0]
}