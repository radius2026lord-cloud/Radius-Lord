export interface Manager {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  username: string;
  password: string; // هذا سيكون الـ hashed password
}
