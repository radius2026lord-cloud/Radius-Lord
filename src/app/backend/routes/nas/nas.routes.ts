import { Router } from 'express';

import {
  createNasController,
  deleteNasController,
  getNasController,
  listNasController,
  setNasStatusController,
  updateNasController,
} from '../../controllers/nas.controller';

const router = Router();

router.get('/', listNasController);
router.get('/:id', getNasController);
router.post('/', createNasController);
router.put('/:id', updateNasController);
router.patch('/:id/status', setNasStatusController);
router.delete('/:id', deleteNasController);

export default router;
