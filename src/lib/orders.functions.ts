import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireClerkAuth, requireClerkOrg } from "@/integrations/clerk/auth-middleware";
import {
  adminAssert,
  listProductsCore,
  getPrimaryProductCore,
  listOrdersCore,
  getOrderCore,
  createOrderCore,
  saveItemDetailsCore,
} from "./orders.core";
import { adminGetOrderCore, adminListOrdersCore, adminSaveDeliverableCore, adminUpdateItemStatusCore } from "./orders.admin.core";

// -------------------- Product catalog --------------------

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => listProductsCore({ supabase: context.supabase }));

export const getPrimaryProduct = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => getPrimaryProductCore({ supabase: context.supabase }));

// -------------------- Customer orders --------------------

export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([requireClerkOrg])
  .handler(async ({ context }) =>
    listOrdersCore({ supabase: context.supabase, orgId: context.orgId, userId: context.userId }),
  );

export const getMyOrder = createServerFn({ method: "GET" })
  .middleware([requireClerkOrg])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) =>
    getOrderCore(
      { supabase: context.supabase, orgId: context.orgId, userId: context.userId },
      data.id,
    ),
  );

export const createOrderAndCheckout = createServerFn({ method: "POST" })
  .middleware([requireClerkOrg])
  .inputValidator((i) => z.object({ quantity: z.number().int().min(1).max(10) }).parse(i))
  .handler(async ({ context, data }) =>
    createOrderCore(
      { supabase: context.supabase, orgId: context.orgId, userId: context.userId },
      { quantity: data.quantity },
    ),
  );

const itemDetailSchema = z.object({
  order_item_id: z.string().uuid(),
  data: z.record(z.string(), z.unknown()),
});

export const saveItemDetails = createServerFn({ method: "POST" })
  .middleware([requireClerkOrg])
  .inputValidator((i) =>
    z
      .object({
        order_id: z.string().uuid(),
        items: z.array(itemDetailSchema).min(1),
        submit: z.boolean().default(false),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) =>
    saveItemDetailsCore(
      { supabase: context.supabase, orgId: context.orgId, userId: context.userId },
      data,
    ),
  );

// -------------------- Admin --------------------

export const adminListOrders = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    await adminAssert(context);
    return adminListOrdersCore(context.supabase);
  });

export const adminGetOrder = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await adminAssert(context);
    return adminGetOrderCore(context.supabase, data.id);
  });

export const adminUpdateItemStatus = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["waiting", "creating", "warming", "ready", "delivered", "cancelled"]),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await adminAssert(context);
    return adminUpdateItemStatusCore(context.supabase, data.id, data.status);
  });

export const adminSaveDeliverable = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i) =>
    z
      .object({
        order_item_id: z.string().uuid(),
        data: z.record(z.string(), z.unknown()),
        mark_ready: z.boolean().default(false),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await adminAssert(context);
    return adminSaveDeliverableCore(
      context.supabase,
      context.userId,
      data.order_item_id,
      data.data,
      data.mark_ready,
    );
  });
