import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

// Request Interceptor: Attach JWT Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('carepath_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Normalize Response & Handle 401
api.interceptors.response.use(
  (response) => {
    // Return the response body (unified envelope)
    return response.data;
  },
  (error) => {
    const status = error.response?.status;
    const responseData = error.response?.data;

    // Handle session expiration
    if (status === 401) {
      localStorage.removeItem('carepath_token');
      localStorage.removeItem('carepath_user');
      window.dispatchEvent(new Event('carepath_auth_expired'));
    }

    const errorMessage =
      responseData?.message ||
      error.message ||
      'An unexpected network error occurred. Please try again.';

    return Promise.reject({
      message: errorMessage,
      status: status || 500,
      error: responseData?.error || null
    });
  }
);

// Auth Service Endpoints
export const authService = {
  register: (payload) => api.post('/api/auth/register', payload),
  login: (payload) => api.post('/api/auth/login', payload)
};

// User Profile Endpoints
export const userService = {
  getProfile: () => api.get('/api/users/me'),
  updateProfile: (payload) => api.put('/api/users/me', payload)
};

export default api;
