# 真实数据驱动改造清单

## 当前结论

项目当前已经具备一部分 MySQL 基础设施和 API 路由，但还不是完整真实数据驱动：

- 系统管理、规费、办公用车已经有较完整的结构化 MySQL 表。
- OA 模块、审批、运输运营、GPS 仍存在 `*_state` JSON 状态表、内存 seed 或本地 JSON 回退。
- 部分前端页面通过 `/api/...` 获取数据，但后端仍可能读写 JSON 聚合状态，不是逐业务表 CRUD。
- `storage/test-data` 仍承担本地 mock / seed 数据职责，后续只能保留为导入 seed 的来源，不能作为运行时数据源。

## 模块到表的拆分目标

| 模块 | 页面/入口 | 当前主要数据源 | 目标结构化表 | 替换优先级 |
| --- | --- | --- | --- | --- |
| 系统管理 | `/system/*` | `sys_*` 表 + `system-store` JSON 回退 | `sys_company`, `sys_department`, `sys_post`, `sys_user`, `sys_role`, `sys_dict`, `sys_login_log`, `sys_operation_log` | P1 |
| 审批中心 | `/oa-approval/center` | `approval_state.state_json` + 内存 state | `approval_template`, `approval_template_node`, `approval_instance`, `approval_node`, `approval_task`, `approval_log`, `approval_cc`, `approval_business_record` | P1 |
| OA 财务看板 | `/oa-approval/dashboard` | `oa_module_state.state_json` | 聚合查询，不单独落大 JSON；来源为审批、应收应付、现金、工资 | P2 |
| 应收应付 | `/oa-approval/receivable` | `oa_module_state.modules.receivable` | `finance_receivable_payable` | P1 |
| 现金管理 | `/oa-approval/cash` | `oa_module_state.modules.cash` + `cashBalanceRecords` | `finance_cash_flow`, `finance_cash_balance` | P1 |
| 工资管理 | `/oa-approval/salary` | `oa_module_state.modules.salary/org` | `hr_employee`, `hr_salary_template`, `hr_salary_record` | P1 |
| OA 组织架构 | `/oa-approval/org` | `oa_module_state.modules.org` | 组织归并到 `sys_*`，员工扩展进 `hr_employee` | P1 |
| 办公用车 | `/oa-approval/vehicle` | 结构化表 + OA 聚合行 | `office_vehicle`, `office_vehicle_expense`, `office_vehicle_license`, `office_vehicle_insurance`, `office_vehicle_reminder`, `office_vehicle_operation_log` | P2 |
| 运输基础资料 | `/transport/base-data` | `transport/module.vue` 页面 rows | `transport_company`, `transport_customer`, `transport_vehicle`, `transport_crew`, `transport_route`, `transport_supplier`, `transport_fee_subject` | P1 |
| 运输订单 | `/transport/orders` | `transport_operation_record.record_json` | `transport_order` | P1 |
| 加油明细 | `/transport/fuel` | `transport_operation_record.record_json` | `transport_fuel_record` | P1 |
| 高速通行费 | `/transport/etc` | `transport_operation_record.record_json` | `transport_etc_record` | P1 |
| 运营数据 | `/transport/operations` | 前端聚合运输 JSON 数据 | 聚合查询，不落聚合大表；来源为订单、油费、ETC、维保、规费、工资、车贷 | P2 |
| 维保管理 | `/transport/maintenance` | `transport_operation_record.record_json` | `transport_maintenance_order` | P2 |
| 车贷费用 | `/transport/vehicle-loans` | `transport_operation_record.record_json` | `transport_vehicle_loan`, `transport_vehicle_loan_payment` | P2 |
| 规费管理 | `/transport/fees` | `regulatory_fee` | `regulatory_fee` | P3 |
| GPS/北斗 | `/transport/gps` | `gps_state.state_json` | `gps_provider_config`, `gps_device`, `gps_vehicle_bind`, `gps_location_latest`, `gps_track_point`, `gps_alarm`, `gps_geofence`, `gps_geofence_vehicle`, `gps_sync_log`, `gps_operation_log` | P3 |
| 贸易订单 | `/trade/orders` | `trade-order-store` | `trade_order` | P3 |
| 酒店营收 | `/hotel/revenue` | `hotel-revenue-store` | `hotel_revenue` | P3 |

## 字段命名原则

- 数据库字段使用 `snake_case`。
- 前端 TypeScript 接口继续使用 `camelCase`。
- API 层负责字段转换，不能让页面直接依赖数据库字段。
- 金额统一 `DECIMAL(14, 2)`，数量/重量/里程统一 `DECIMAL(14, 3)` 或 `DECIMAL(12, 2)`。
- 状态字段先保留中文展示值，后续可逐步改为字典编码 + label。
- 所有业务表保留 `created_at`, `updated_at`, `deleted_at`，列表默认过滤 `deleted_at IS NULL`。
- 审批相关业务表统一保留 `approval_status`, `approval_instance_id`, `approved_at`, `rejected_at`, `revoked_at`。

## 关联关系

### 运输

- `transport_order.vehicle_id -> transport_vehicle.id`
- `transport_order.customer_id -> transport_customer.id`
- `transport_order.route_id -> transport_route.id`
- `transport_fuel_record.order_id -> transport_order.id`
- `transport_etc_record.order_id -> transport_order.id`
- `transport_maintenance_order.vehicle_id -> transport_vehicle.id`
- `transport_vehicle_loan.vehicle_id -> transport_vehicle.id`
- `regulatory_fee.plate_no` 后续应补 `vehicle_id`，保留车牌兼容历史数据。

### 工资/OA

- `hr_employee.user_id -> sys_user.id`
- `hr_employee.company_id -> sys_company.id`
- `hr_employee.dept_id -> sys_department.id`
- `hr_employee.post_id -> sys_post.id`
- `hr_salary_template.employee_id -> hr_employee.id`
- `hr_salary_record.employee_id -> hr_employee.id`
- `finance_receivable_payable.approval_instance_id -> approval_instance.id`
- `finance_cash_flow.approval_instance_id -> approval_instance.id`

### 审批

- `approval_instance.business_type + business_id` 关联任意业务表。
- `approval_business_record` 作为审批中心统一业务索引。
- 业务表审批状态由审批回调更新，避免页面手工改状态。

## 替换 JSON store 的执行顺序

1. 审批中心：先替换 `approval_state`，因为其他业务都依赖审批状态。
2. 工资/组织：把 `oa_module_state.modules.org/salary` 拆到 `sys_* + hr_*`。
3. 运输基础资料和运输订单：先拆 `transport_vehicle/customer/route/order`。
4. 加油明细和 ETC：实现按车号 + 时间节点自动归集到订单。
5. 应收应付和现金：拆 `finance_*`，再让财务看板只做聚合查询。
6. 运营数据：改成后端聚合接口，前端只展示聚合结果和明细跳转。
7. GPS、贸易、酒店：按独立模块逐步替换状态 JSON。

## API 改造规范

每个业务模块至少提供：

- `GET /api/<module>`：分页/筛选列表。
- `GET /api/<module>/<id>`：详情。
- `POST /api/<module>`：创建。
- `PUT /api/<module>/<id>`：更新。
- `DELETE /api/<module>/<id>`：软删除。
- 聚合页单独提供 `/summary` 或 `/overview`，不让前端拼复杂跨模块统计。

前端页面必须统一处理：

- loading：列表、详情、保存按钮分别有状态。
- empty：无数据时显示业务化空态。
- error：接口失败提示，并保留重试入口。
- optimistic update 只允许用于非关键字段，金额/审批状态必须以服务端返回为准。

## 本轮新增迁移

新增迁移文件：

- `deploy/mysql/migrations/20260709_001_business_schema.sql`

该迁移不会删除现有 `approval_state`, `oa_module_state`, `transport_operation_record`, `gps_state`，它们在迁移期作为兼容来源保留。后续完成页面替换并完成数据搬迁后，再单独做清理迁移。

## 云端部署要求

部署到云端时必须配置：

- `DB_CLIENT=mysql`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_REQUIRED=true`
- `JWT_SECRET`
- `SESSION_SECRET`

上线流程：

1. 安装依赖。
2. 执行 `pnpm migrate:mysql`，创建初始化表和业务迁移表。
3. 执行 `pnpm build`。
4. 执行 `pnpm start`。

`DB_REQUIRED=true` 或 `NODE_ENV=production` 时，后端数据库配置不完整会直接报错，不允许回退到 `storage/test-data`、`storage/runtime/json` 或内存数据。
