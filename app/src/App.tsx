import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import AppHeader from './components/AppHeader'
import MyBurrow from './screens/burrow/MyBurrow'

function AppLayout() {
  return (
    <>
      <AppHeader />
      <Outlet />
    </>
  )
}

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/burrow', element: <MyBurrow /> },
    ],
  },
  { path: '*', element: <Navigate to="/burrow" replace /> },
])
