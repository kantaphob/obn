# Datahaus

ระบบหลังบ้าน CRUD สำหรับจัดการรายการข้อมูลทั่วไป พัฒนาด้วย Next.js 16, Prisma ORM 7 และ SQLite

## เริ่มใช้งาน

ต้องใช้ Node.js 20.19 ขึ้นไป

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:generate
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000) เพื่อใช้งานระบบ ฐานข้อมูล SQLite จะถูกสร้างเป็น `dev.db` ที่โฟลเดอร์โปรเจกต์

## คำสั่งฐานข้อมูล

- `npm run db:migrate -- --name ชื่อการเปลี่ยนแปลง` สร้างและใช้ migration
- `npm run db:generate` สร้าง Prisma Client หลังแก้ schema
- `npm run db:studio` เปิด Prisma Studio

## API

- `GET /api/entries` อ่านรายการ และกรองด้วย `q`, `category`, `status` ได้
- `POST /api/entries` สร้างรายการ
- `PATCH /api/entries/:id` แก้ไขรายการ
- `DELETE /api/entries/:id` ลบรายการ
- `GET /api/entries/export` ดาวน์โหลดข้อมูลเป็น CSV

โมเดลเริ่มต้นมีชื่อรายการ หมวดหมู่ รายละเอียด และสถานะ ปรับเพิ่มตารางและความสัมพันธ์ได้ที่ `prisma/schema.prisma`

> การตั้งค่านี้ใช้ SQLite ในเครื่องและยังไม่มีระบบเข้าสู่ระบบ ควรเพิ่มการยืนยันตัวตนและใช้ฐานข้อมูลที่รองรับงานจริงก่อนเปิดให้ผู้ใช้อื่นเข้าถึงหรือ deploy
