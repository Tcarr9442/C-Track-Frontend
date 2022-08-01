import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useMSAL } from '../Helpers/MSAL';
import PageTemplate from './Template'
import axios from 'axios'
import Select from 'react-select';
import PartService from '../Services/Parts'
import '../css/Asset.css'
import '../css/Jobs.css'

function PartCategoriesPage(props) {
    // MSAL stuff
    const { token } = useMSAL()

    // States
    const [newData, setNewData] = useState({})
    const [refreshData, setRefreshData] = useState(true)
    const [data, setData] = useState([])

    // useEffect
    useEffect(() => {
        if (!token) return
        async function getData() {
            let res = await axios.get(`${require('../settings.json').APIBase}/parts/common`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Access-Control-Allow-Origin': '*',
                    'X-Version': require('../backendVersion.json').version
                }
            })
            if (res.isErrored) return console.log(res)
            setData(res.data || [])
        }
        if (refreshData) getData()
        setRefreshData(false)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshData, token])


    // Permission Check
    if (!props.permissions.use_importer && !props.isAdmin) return <Navigate to='/' />


    // Event Handlers
    const handleTextInputChange = (e, id) => {
        if (!e || !e.target || !e.target.value) return
        setNewData({ ...newData, type: e.target.value })
        sendData({ previous: id, value: e.target.value, selection: newData.selection || [], change: 'part_type' }, id)
    }

    const handleKeyDown = (e, id) => {
        if (e.key === 'Enter') handleTextInputChange(e, id)
    }

    const handleSelectionChange = (e, id) => {
        if (id !== 'new') sendData({ value: e.map(m => m.value).join(','), change: 'manufacturer', part: id }, id)
        setNewData({ ...newData, manufacturer: e.map(m => m.value).join(',') })
    }

    // Misc Functions
    const sendData = async (data, id) => {
        let res
        if (id === 'new') res = PartService.newPartType(data, token)
        else res = PartService.editPartType(data, token)
        if (res.isErrored) return console.log(res)
        setRefreshData(true)
        document.getElementById('new-type').value = ''
        setNewData({})
    }

    // Renderers
    const renderType = row => {
        let defaultOptions = []
        if (row.manufacturer) for (let i of row.manufacturer.split(',')) if (multiSelectIndexer[i] !== null) defaultOptions.push(multiSelectOptions[multiSelectIndexer[i]])
        return <tr key={row.part_type}>
            <td><input
                type='text'
                defaultValue={row.part_type}
                id={row.part_type}
                onBlur={(e) => handleTextInputChange(e, row.part_type)}
                onKeyDown={e => handleKeyDown(e, row.part_type)}
            /></td>
            <td><Select menuPlacement='auto'
                options={multiSelectOptions}
                defaultValue={defaultOptions}
                isMulti
                closeMenuOnSelect={false}
                styles={selectStyles}
                isSearchable
                onChange={e => handleSelectionChange(e, row.part_type)} /></td>
        </tr>
    }

    // Base JSX
    return (
        <>
            <div className='AssetArea' style={{ top: '8vh', height: '92vh' }}>
                <table className='rows'>
                    <thead>
                        <tr>
                            <th style={{ width: '50%' }}>Part Type</th>
                            <th style={{ width: '50%' }}>Manufacturer</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map(renderType)}
                        <tr key='new'>
                            <td><input
                                type='text'
                                placeholder='New...'
                                id={`new-type`}
                                onBlur={(e) => handleTextInputChange(e, 'new')}
                                onKeyDown={e => handleKeyDown(e, 'new')}
                            /></td>
                            <td><Select menuPlacement='auto'
                                options={multiSelectOptions}
                                isMulti
                                closeMenuOnSelect={false}
                                styles={selectStyles}
                                isSearchable
                                onChange={e => handleSelectionChange(e, 'new')} /></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <PageTemplate highLight='part_types' {...props} />
        </>
    )
}

export default PartCategoriesPage

const multiSelectOptions = [
    { value: 'HP', label: 'HP' },
    { value: 'Dell', label: 'Dell' },
    { value: 'Lenovo', label: 'Lenovo' },
    { value: 'Samsung', label: 'Samsung' }
]

const multiSelectIndexer = {}
for (let i in multiSelectOptions) multiSelectIndexer[multiSelectOptions[i].value] = i

const selectStyles = {
    control: (styles, { selectProps: { width } }) => ({
        ...styles,
        backgroundColor: 'transparent',
        width
    }),
    menu: (provided, state) => ({
        ...provided,
        width: state.selectProps.width,
    }),
    noOptionsMessage: (styles) => ({
        ...styles,
        backgroundColor: '#1b1b1b'
    }),
    menuList: (styles) => ({
        ...styles,
        backgroundColor: '#1b1b1b'
    }),
    option: (styles, { data, isDisabled, isFocused, isSelected }) => {
        return {
            ...styles,
            backgroundColor: '#1b1b1b',
            color: 'white',
            ':active': {
                ...styles[':active'],
                backgroundColor: localStorage.getItem('accentColor') || '#003994',
            },
            ':hover': {
                ...styles[':hover'],
                backgroundColor: localStorage.getItem('accentColor') || '#003994'
            }
        };
    },
    multiValue: (styles, { data }) => {
        return {
            ...styles,
            backgroundColor: localStorage.getItem('accentColor') || '#003994',
        };
    },
    multiValueLabel: (styles, { data }) => ({
        ...styles,
        color: data.color,
    }),
    multiValueRemove: (styles, { data }) => ({
        ...styles,
        color: 'white',
        ':hover': {
            color: 'red',
        },
    }),

}