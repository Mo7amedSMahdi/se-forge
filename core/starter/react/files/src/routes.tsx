import { Navigate, type RouteObject } from 'react-router';
import { HomePage } from '@/home/HomePage';
import { Layout } from '@/Layout';

// One route per page; feature pages go in their own folders (skill new-page).
export const routes: RouteObject[] = [
  { element: <Layout />, children: [
    { path: '/', element: <HomePage /> },
    { path: '*', element: <Navigate to="/" replace /> },
  ] },
];
