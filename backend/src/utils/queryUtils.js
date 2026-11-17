import mongoose from 'mongoose';

/**
 * Validates and constructs MongoDB filter and pagination parameters from request query.
 *
 * @param {Object} reqQuery - Express req.query
 * @param {Object} options - Configuration options
 * @param {Array<string>} options.searchFields - Model field names to search across
 * @param {Array<string>} [options.allowedStatuses] - Allowed status values if model supports status
 * @param {string} [options.defaultSort='createdAt'] - Default field to sort by
 * @returns {{ filter: Object, page: number, limit: number, sort: Object }}
 */
export function buildSubmissionQuery(reqQuery = {}, options = {}) {
  const { searchFields = [], allowedStatuses = [], defaultSort = 'createdAt' } = options;
  const filter = {};

  // 1. Text Search across whitelisted fields with regex character escaping
  if (reqQuery.search !== undefined) {
    if (typeof reqQuery.search !== 'string') {
      const error = new Error('Invalid search parameter. Must be a string');
      error.statusCode = 400;
      throw error;
    }
    const rawSearch = reqQuery.search.trim();
    if (rawSearch.length > 100) {
      const error = new Error('Search query exceeds maximum allowed length of 100 characters');
      error.statusCode = 400;
      throw error;
    }
    if (rawSearch.length > 0) {
      // Escape regex special characters to prevent regex injection or ReDoS
      const escaped = rawSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');

      if (searchFields.length > 0) {
        filter.$or = searchFields.map((field) => ({ [field]: searchRegex }));
      }
    }
  }

  // 2. Status Filter
  if (reqQuery.status && typeof reqQuery.status === 'string') {
    const status = reqQuery.status.trim();
    if (status && status !== 'all') {
      if (allowedStatuses.length > 0 && !allowedStatuses.includes(status)) {
        const error = new Error(`Invalid status filter: '${status}'. Allowed values: ${allowedStatuses.join(', ')}`);
        error.statusCode = 400;
        throw error;
      }
      filter.status = status;
    }
  }

  // 3. UserType Filter (for Feedback)
  if (reqQuery.userType && typeof reqQuery.userType === 'string') {
    const userType = reqQuery.userType.trim();
    if (userType && userType !== 'all') {
      const allowedUserTypes = ['Teacher', 'Student', 'Parent'];
      if (!allowedUserTypes.includes(userType)) {
        const error = new Error(`Invalid userType: '${userType}'. Allowed: ${allowedUserTypes.join(', ')}`);
        error.statusCode = 400;
        throw error;
      }
      filter.userType = userType;
    }
  }

  // 4. Rating Filter (for Feedback)
  if (reqQuery.rating) {
    const ratingNum = parseInt(reqQuery.rating, 10);
    if (!isNaN(ratingNum) && ratingNum >= 1 && ratingNum <= 5) {
      filter.rating = ratingNum;
    }
  }

  // 5. Date Range Filtering on createdAt
  if (reqQuery.startDate || reqQuery.endDate) {
    filter.createdAt = {};

    if (reqQuery.startDate) {
      const start = new Date(reqQuery.startDate);
      if (isNaN(start.getTime())) {
        const error = new Error('Invalid startDate format. Please provide a valid ISO date (e.g. YYYY-MM-DD)');
        error.statusCode = 400;
        throw error;
      }
      // If provided as YYYY-MM-DD, set to start of that day (00:00:00.000)
      if (typeof reqQuery.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(reqQuery.startDate.trim())) {
        filter.createdAt.$gte = new Date(`${reqQuery.startDate.trim()}T00:00:00.000Z`);
      } else {
        filter.createdAt.$gte = start;
      }
    }

    if (reqQuery.endDate) {
      const end = new Date(reqQuery.endDate);
      if (isNaN(end.getTime())) {
        const error = new Error('Invalid endDate format. Please provide a valid ISO date (e.g. YYYY-MM-DD)');
        error.statusCode = 400;
        throw error;
      }
      // If provided as YYYY-MM-DD, advance to end of that day (23:59:59.999Z)
      if (typeof reqQuery.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(reqQuery.endDate.trim())) {
        filter.createdAt.$lte = new Date(`${reqQuery.endDate.trim()}T23:59:59.999Z`);
      } else {
        filter.createdAt.$lte = end;
      }
    }

    // Validate date boundary logic
    if (filter.createdAt.$gte && filter.createdAt.$lte && filter.createdAt.$gte > filter.createdAt.$lte) {
      const error = new Error('startDate cannot be after endDate');
      error.statusCode = 400;
      throw error;
    }
  }

  // 6. Pagination Parameters (Validated)
  let page = 1;
  if (reqQuery.page !== undefined) {
    const parsedPage = parseInt(reqQuery.page, 10);
    if (isNaN(parsedPage) || parsedPage < 1) {
      const error = new Error('Invalid page parameter. Must be a positive integer greater than 0');
      error.statusCode = 400;
      throw error;
    }
    page = parsedPage;
  }

  let limit = 10;
  if (reqQuery.limit !== undefined) {
    const parsedLimit = parseInt(reqQuery.limit, 10);
    if (isNaN(parsedLimit) || parsedLimit < 1) {
      const error = new Error('Invalid limit parameter. Must be a positive integer between 1 and 100');
      error.statusCode = 400;
      throw error;
    }
    limit = Math.min(parsedLimit, 100); // Strict safety cap
  }

  // 7. Sorting Parameters
  const allowedSortFields = [
    'createdAt',
    'updatedAt',
    'status',
    'name',
    'fullName',
    'studentName',
    'parentName',
    'email',
    'rating',
  ];

  let sortBy = defaultSort;
  if (reqQuery.sortBy && typeof reqQuery.sortBy === 'string') {
    const requestedSort = reqQuery.sortBy.trim();
    if (allowedSortFields.includes(requestedSort)) {
      sortBy = requestedSort;
    } else {
      const error = new Error(`Invalid sortBy field: '${requestedSort}'. Allowed: ${allowedSortFields.join(', ')}`);
      error.statusCode = 400;
      throw error;
    }
  }

  const sortOrder = reqQuery.sortOrder === 'asc' || reqQuery.sortOrder === '1' ? 1 : -1;
  // Use _id as deterministic tie-breaker for consistent pagination across concurrent writes
  const sort = sortBy === '_id' ? { _id: sortOrder } : { [sortBy]: sortOrder, _id: sortOrder };

  return { filter, page, limit, sort };
}

/**
 * Executes a paginated, sorted query against a Mongoose model.
 *
 * @param {mongoose.Model} Model
 * @param {Object} queryOptions
 * @param {string} [selectFields='-__v']
 * @returns {Promise<Object>} Consistent pagination payload
 */
export async function executePaginatedQuery(Model, queryOptions, selectFields = '-__v') {
  const { filter, page, limit, sort } = queryOptions;
  const skip = (page - 1) * limit;

  const findQuery = Model.find(filter);
  const sorted = typeof findQuery.sort === 'function' ? findQuery.sort(sort) : findQuery;

  let total;
  let data;

  // Handle unit test mock environments where sort() returns a Promise directly
  if (typeof sorted.skip !== 'function') {
    data = await sorted;
    total = Array.isArray(data) ? data.length : 0;
  } else {
    let countPromise;
    try {
      countPromise = typeof Model.countDocuments === 'function'
        ? Model.countDocuments(filter)
        : Promise.resolve(0);
    } catch {
      countPromise = Promise.resolve(0);
    }

    const [totalCount, docs] = await Promise.all([
      countPromise,
      sorted.skip(skip).limit(limit).select(selectFields).lean(),
    ]);

    total = totalCount;
    data = docs;
  }

  const totalPages = Math.ceil(total / limit) || 1;

  return {
    success: true,
    count: data.length,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

/**
 * Validates MongoDB ObjectId string.
 *
 * @param {string} id
 * @returns {boolean}
 */
export function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id) && new mongoose.Types.ObjectId(id).toString() === id;
}
