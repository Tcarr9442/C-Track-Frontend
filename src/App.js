/* eslint-disable no-unreachable */
import React, { useState, useEffect } from 'react';
import {
  Switch,
  Route,
  BrowserRouter
} from "react-router-dom";

// Import the Pages
import AdminPage from './Pages/Admin';
import AssetPage from './Pages/Asset';
import AssetsPage from './Pages/AssetPage';
import HomePage from './Pages/Home';
import HourlyPage from './Pages/Hourly';
import ImporterPage from './Pages/Importer'
import JobPage from './Pages/Jobs';
import LoginPage from './Pages/Login';
import ModelPage from './Pages/Models';
import ReportsPage from './Pages/Reports';
import SingleAssetPage from './Pages/SingleAsset'
import UserPage from './Pages/User';

// Import Libraries
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError } from '@azure/msal-common';
import UserService from './Services/User'
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


  useEffect(() => {
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
    async function loadPermissions() {
      let t = await getTokenSilently()
      const response = await fetch(`${settings.APIBase}/user/permissions`, {
        mode: 'cors',
        headers: {
          'Authorization': `Bearer ${t}`,
          'Access-Control-Allow-Origin': '*'
        }
      });
      const data = await response.json();
      setLoginStatus(data.permissions, data.isAdmin ? true : false)
    }
    if (isAuthenticated) loadPermissions()
  }, [isAuthenticated, accounts, instance])

  async function validateUser() {
    //Get token
    const SilentRequest = { scopes: ['User.Read'], account: instance.getAccountByLocalId(accounts[0].localAccountId), forceRefresh: true }
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
      localStorage.setItem('isVerified', "yes")
      setAuthed(true)
    }
  }


  if (isAuthenticated && !isAuthed) validateUser()


  if (isAuthenticated && !loading) return (
    <BrowserRouter>
      <Switch>
        <Route exact path="/asset" render={props => <AssetPage {...props} permissions={permissions} isAdmin={isAdmin} />} />
        <Route exact path="/assets" render={props => <AssetsPage {...props} permissions={permissions} isAdmin={isAdmin} />} />
        <Route exact path="/models" render={props => <ModelPage {...props} permissions={permissions} isAdmin={isAdmin} />} />
        <Route exact path="/hourly" render={props => <HourlyPage {...props} permissions={permissions} isAdmin={isAdmin} />} />
        <Route exact path="/admin" render={props => <AdminPage {...props} permissions={permissions} isAdmin={isAdmin} />} />
        <Route exact path="/importer" render={props => <ImporterPage {...props} permissions={permissions} isAdmin={isAdmin} />} />
        <Route exact path="/tools" render={props => <HomePage {...props} permissions={permissions} isAdmin={isAdmin} />} />
        <Route exact path="/reports" render={props => <ReportsPage {...props} permissions={permissions} isAdmin={isAdmin} />} />
        <Route exact path="/jobs" render={props => <JobPage {...props} permissions={permissions} isAdmin={isAdmin} />} />
        <Route exact path="/users" render={props => <UserPage {...props} permissions={permissions} isAdmin={isAdmin} />} />
        <Route exact path="/search" render={props => <SingleAssetPage {...props} permissions={permissions} isAdmin={isAdmin} />} />
        <Route exact path="/" render={props => <HomePage {...props} permissions={permissions} isAdmin={isAdmin} />} />
      </Switch>
    </BrowserRouter>
  )
  if (!isAuthenticated) return (
    <LoginPage />
  )
  else return (
    <Particles color={localStorage.getItem('accentColor') || '#e3de00'}/>
  )
}

export default App;
