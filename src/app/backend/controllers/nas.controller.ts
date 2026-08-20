import { Request, Response } from 'express';

import {
  validateCreateNas,
  validateUpdateNas,
} from '../schemas/nas.schema';
import { NasService, NasServiceError } from '../services/nas/nas.service';

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function handleError(res: Response, error: unknown) {
  if (error instanceof NasServiceError) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }

  console.error('NAS error:', error);
  return res.status(500).json({
    success: false,
    message: 'خطأ في الخادم',
  });
}

export const listNasController = async (_req: Request, res: Response) => {
  try {
    const data = await NasService.list();
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getNasController = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ success: false, message: 'NAS id غير صحيح' });
  }

  try {
    const data = await NasService.getById(id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
};

export const createNasController = async (req: Request, res: Response) => {
  const parsed = validateCreateNas(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: parsed.message });
  }

  try {
    const data = await NasService.create(parsed.data);
    return res.status(201).json({
      success: true,
      message: 'تمت إضافة NAS بنجاح',
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const updateNasController = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ success: false, message: 'NAS id غير صحيح' });
  }

  const parsed = validateUpdateNas(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: parsed.message });
  }

  try {
    const data = await NasService.update(id, parsed.data);
    return res.json({
      success: true,
      message: 'تم تعديل NAS بنجاح',
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const setNasStatusController = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ success: false, message: 'NAS id غير صحيح' });
  }

  const status = req.body?.status;
  if (status !== 'active' && status !== 'disabled') {
    return res.status(400).json({
      success: false,
      message: 'status يجب أن يكون active أو disabled',
    });
  }

  try {
    const data = await NasService.setStatus(id, status);
    return res.json({
      success: true,
      message: status === 'active' ? 'تم تفعيل NAS' : 'تم تعطيل NAS',
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const deleteNasController = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ success: false, message: 'NAS id غير صحيح' });
  }

  try {
    await NasService.remove(id);
    return res.json({
      success: true,
      message: 'تم حذف NAS وجميع البيانات المرتبطة به بنجاح',
    });
  } catch (error) {
    return handleError(res, error);
  }
};
