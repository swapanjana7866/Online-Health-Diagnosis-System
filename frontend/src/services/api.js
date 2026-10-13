import axios from 'axios';

const API_TARGET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_BASE_URL = import.meta.env.DEV ? '' : API_TARGET_URL;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 35000
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

    const errorMessage = responseData?.message ||
      (error.code === 'ECONNABORTED'
        ? 'The API request timed out. Check that the backend and database are running, then try again.'
        : !error.response
          ? `Cannot reach the API at ${API_TARGET_URL}. Start the backend and verify VITE_API_URL in frontend/.env.`
          : error.message || 'An unexpected error occurred. Please try again.');

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

export const appointmentService = {
  getDoctors: () => api.get('/api/doctors'),
  getAppointments: () => api.get('/api/appointments'),
  bookAppointment: (payload) => api.post('/api/appointments', payload)
};

export const diagnosisService = {
  getSymptoms: () => api.get('/api/diagnoses/symptoms'),
  predict: (payload) => api.post('/api/diagnoses/predict', payload, { timeout: 35000 }),
  getHistory: (page = 1, limit = 10) => api.get(`/api/diagnoses/history?page=${page}&limit=${limit}`),
  getById: (id) => api.get(`/api/diagnoses/${id}`),
  delete: (id) => api.delete(`/api/diagnoses/${id}`)
};

export const chatService = {
  sendMessage: (payload) =>
    api.post('/api/chat/message', payload, { timeout: 30000 })
};

export default api;
