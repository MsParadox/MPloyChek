// MPloyChek — UserService (thin facade over repositories)
import { userRepo } from '../repositories/user.repository';
import { refreshTokenRepo } from '../repositories/index';
export class UserService {
  getAllUsers()          { return userRepo.findAll(); }
  getUserById(id:string){ return userRepo.findById(id); }
  getStats()            { return userRepo.getStats(); }
  async createUser(d:any){ return userRepo.create(d); }
  updateUser(id:string,p:any){ return userRepo.update(id,p); }
  deleteUser(id:string){ return userRepo.delete(id); }
}
export const userService = new UserService();
