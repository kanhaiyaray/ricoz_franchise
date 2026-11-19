import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { Employee } from "../../models/employee.models.js";
import { ApiError } from "../../utils/apiError.utils.js";
import type {
  CreateEmployeeDto,
  ListEmployeesQuery,
  UpdateEmployeeDto,
} from "./employee.validation.js";

function getObjectId(value: string | string[] | undefined) {
  if (typeof value !== "string" || !Types.ObjectId.isValid(value)) {
    throw new ApiError(400, "Invalid employee ID.");
  }
  return new Types.ObjectId(value);
}

function getActorId(req: Request) {
  if (!req.user?.id || !Types.ObjectId.isValid(req.user.id)) {
    throw new ApiError(401, "A valid admin session is required.");
  }
  return new Types.ObjectId(req.user.id);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const listEmployees = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const query = res.locals.query as ListEmployeesQuery;
    const filters: Record<string, unknown>[] = [];

    if (query.q) {
      const search = new RegExp(escapeRegex(query.q), "i");
      filters.push({
        $or: [
          { name: search },
          { designation: search },
          { city: search },
          { skills: search },
        ],
      });
    }

    if (query.category) {
      const category = new RegExp(escapeRegex(query.category), "i");
      filters.push({
        $or: [{ designation: category }, { skills: category }],
      });
    }

    const filter = filters.length ? { $and: filters } : {};
    const [employees, aggregates] = await Promise.all([
      Employee.find(filter)
        .sort({ name: 1 })
        .select("-createdBy -__v")
        .lean(),
      Employee.aggregate([
        {
          $group: {
            _id: null,
            totalRegistered: { $sum: 1 },
            availableNow: {
              $sum: { $cond: [{ $eq: ["$status", "available"] }, 1, 0] },
            },
            onActiveTask: {
              $sum: { $cond: [{ $eq: ["$status", "on_task"] }, 1, 0] },
            },
            averageRating: { $avg: "$rating" },
          },
        },
      ]),
    ]);

    const aggregate = aggregates[0];
    return res.status(200).json({
      success: true,
      employees,
      stats: {
        totalRegistered: aggregate?.totalRegistered ?? 0,
        availableNow: aggregate?.availableNow ?? 0,
        onActiveTask: aggregate?.onActiveTask ?? 0,
        averageRating: aggregate
          ? Number(aggregate.averageRating.toFixed(1))
          : 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getEmployee = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const employee = await Employee.findById(getObjectId(req.params.id))
      .select("-createdBy -__v")
      .lean();
    if (!employee) throw new ApiError(404, "Employee not found.");
    return res.status(200).json({ success: true, employee });
  } catch (error) {
    next(error);
  }
};

export const createEmployee = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const input = req.body as CreateEmployeeDto;
    const employee = await Employee.create({
      ...input,
      createdBy: getActorId(req),
    });
    return res.status(201).json({
      success: true,
      employee: employee.toObject({ versionKey: false }),
    });
  } catch (error) {
    next(error);
  }
};

export const updateEmployee = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const input = req.body as UpdateEmployeeDto;
    const employee = await Employee.findByIdAndUpdate(
      getObjectId(req.params.id),
      { $set: input },
      { new: true, runValidators: true },
    )
      .select("-createdBy -__v")
      .lean();
    if (!employee) throw new ApiError(404, "Employee not found.");
    return res.status(200).json({ success: true, employee });
  } catch (error) {
    next(error);
  }
};

export const deleteEmployee = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const employee = await Employee.findByIdAndDelete(
      getObjectId(req.params.id),
    ).select("_id");
    if (!employee) throw new ApiError(404, "Employee not found.");
    return res.status(200).json({ success: true, id: employee._id });
  } catch (error) {
    next(error);
  }
};
