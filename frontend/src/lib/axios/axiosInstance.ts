import axios, { type CreateAxiosDefaults } from 'axios';
import { ENV } from '../../config';

const config: CreateAxiosDefaults = {
  baseURL: ENV.API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withCredentials: true,
};

// export const axiosInstance = axios.create(config);

export const bffAxiosInstance = axios.create(config)