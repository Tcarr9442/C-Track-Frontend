/* eslint-disable no-unreachable */
import React, { useState, useEffect } from 'react';
import {
  Routes,
  Route,
} from "react-router-dom";

// Import the Pages
import AdminPage from './Pages/Admin';
import AssetManagement from './Pages/AssetManagement'
import AssetPage from './Pages/Asset';
import AssetsPage from './Pages/AssetPage';
import HomePage from './Pages/Home';
import HourlyPage from './Pages/Hourly';
import ImporterPage from './Pages/Importer'
import JobPage from './Pages/Jobs';
import LoginPage from './Pages/Login';
import ModelPage from './Pages/Models';
import ReportsPage from './Pages/Reports';
import SingleAssetPage from './Pages/SingleAsset';
import UserPage from './Pages/User';
import GuidePage from './Pages/Guide';
import PartCategoriesPage from './Pages/Part Types'
import PartInventoryPage from './Pages/Part Inventory'
import PartManagementPage from './Pages/Part Management'
import RepairLogPage from './Pages/Repair Log'

// Import Libraries
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError } from '@azure/msal-common';
import UserService from './Services/User'
// import TSheetsService from './Services/TSheets'
import './App.css';
import Particles from './Components/Particles';
const settings = require('./settings.json')

function App(props) {
  const isAuthenticated = useIsAuthenticated();
  const { instance, accounts } = useMsal()
  const [isAuthed, setAuthed] = useState(localStorage.getItem('isVerified'))
  const [{ permissions, isAdmin, loading }, setState] = useState({
    permissions: null,
    isAdmin: null,
    loading: true,
  })
  const setLoginStatus = (perm, admin) => setState({ permissions: perm, isAdmin: admin, loading: false })
  // const [tsheetsBearer, setTsheetsBearer] = useState(null)


  useEffect(() => {
    async function getTokenSilently() {
      const SilentRequest = { scopes: ['User.Read', 'TeamsActivity.Send'], account: instance.getAccountByLocalId(accounts[0].localAccountId), forceRefresh: true }
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
    async function loadPermissions() {
      let t = await getTokenSilently()
      const response = await fetch(`${settings.APIBase}/user/permissions`, {
        mode: 'cors',
        headers: {
          'Authorization': `Bearer ${t}`,
          'Access-Control-Allow-Origin': '*',
          'X-Version': require('./backendVersion.json').version
        }
      });
      const data = await response.json();
      if (data.message === 'An upgrade is available. Please refresh the page.') alert(data.message)
      setLoginStatus(data.permissions, data.isAdmin ? true : false,)

      //Get TSheets token
      // let ts = await TSheetsService.getToken(t)
      // if (!ts.isErrored) {
      //   setTsheetsBearer(ts.token)
      // }
    }
    if (isAuthenticated) loadPermissions()
  }, [isAuthenticated, accounts, instance])

  async function validateUser() {
    //Get token
    const SilentRequest = { scopes: ['User.Read', 'TeamsActivity.Send'], account: instance.getAccountByLocalId(accounts[0].localAccountId), forceRefresh: true }
    let res = await instance.acquireTokenSilent(SilentRequest)
      .catch(async er => {
        if (er instanceof InteractionRequiredAuthError) {
          return await instance.acquireTokenPopup(SilentRequest)
        } else {
          console.log('Unable to get token')
          return { isErrored: true, err: er }
        }
      })
    if (res.isErrored) return console.log(res.err)

    //Check to see if user exists
    res = await UserService.verify(res.accessToken)
    if (res.isErrored) return console.log(res.err)
    else {
      localStorage.setItem('isVerified', true)
      setAuthed(true)
    }
  }


  if (isAuthenticated && !isAuthed) validateUser()

  if (isAuthenticated && !loading) return (
    <>
      <Particles {...props} permissions={permissions} color={localStorage.getItem('accentColor') || '#00c6fc'} />
      <Routes>
        <Route exact path="/asset" element={<AssetPage {...props} permissions={permissions} isAdmin={isAdmin} />} />
        <Route exact path="/assets" element={<AssetsPage {...props} permissions={permissions} isAdmin={isAdmin} />} />
        <Route exact path="/models" element={<ModelPage {...props} permissions={permissions} isAdmin={isAdmin} />} />
        <Route exact path="/hourly" element={<HourlyPage {...props} permissions={permissions} isAdmin={isAdmin} />} />
        <Route exact path="/admin" element={<AdminPage {...props} permissions={permissions} isAdmin={isAdmin} />} />
        <Route exact path="/adas" element={<AssetManagement {...props} permissions={permissions} isAdmin={isAdmin} />} />
        <Route exact path="/importer" element={<ImporterPage {...props} permissions={permissions} isAdmin={isAdmin} />} />
        <Route exact path="/tools" element={<HomePage {...props} permissions={permissions} isAdmin={isAdmin} />} />
        <Route exact path="/reports" element={<ReportsPage {...props} permissions={permissions} isAdmin={isAdmin} />} />
        <Route exact path="/jobs" element={<JobPage {...props} permissions={permissions} isAdmin={isAdmin} />} />
        <Route exact path="/users" element={<UserPage {...props} permissions={permissions} isAdmin={isAdmin} />} />
        <Route exact path="/search" element={<SingleAssetPage {...props} permissions={permissions} isAdmin={isAdmin} />} />
        <Route exact path="/guide" element={<GuidePage {...props} permissions={permissions} isAdmin={isAdmin} />} />
        <Route exact path="/repair" element={<RepairLogPage {...props} permissions={permissions} isAdmin={isAdmin} />} />
        <Route exact path="/inventory" element={<PartInventoryPage {...props} permissions={permissions} isAdmin={isAdmin} />} />
        <Route exact path="/parts" element={<PartManagementPage {...props} permissions={permissions} isAdmin={isAdmin} />} />
        <Route exact path="/parttypes" element={<PartCategoriesPage {...props} permissions={permissions} isAdmin={isAdmin} />} />
        <Route exact path="/" element={<HomePage {...props} permissions={permissions} isAdmin={isAdmin} />} />
      </Routes>
    </>
  )
  if (!isAuthenticated) return (
    <LoginPage />
  )
  else return (
    <Particles color={localStorage.getItem('accentColor') || '#00c6fc'} />
  )
}

export default App;
