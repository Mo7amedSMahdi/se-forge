import { Navigate, type RouteObject } from 'react-router';
import { Layout } from '@/Layout';
import { NewUserPage } from '@/users/NewUserPage';
import { UsersPage } from '@/users/UsersPage';

export const routes: RouteObject[] = [
  { element: <Layout />, children: [
    { path: '/', element: <Navigate to="/users" replace /> },
    { path: '/users', element: <UsersPage /> },
    { path: '/users/new', element: <NewUserPage /> },
  ] },
];
