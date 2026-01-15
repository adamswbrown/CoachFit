import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addAdminRole() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'adamswbrown@gmail.com' },
      select: { id: true, email: true, roles: true }
    })
    
    if (!user) {
      console.log('❌ User not found')
      process.exit(0)
    }
    
    console.log('Current roles:', user.roles)
    
    if (!user.roles.includes('ADMIN')) {
      await prisma.user.update({
        where: { email: 'adamswbrown@gmail.com' },
        data: { roles: [...user.roles, 'ADMIN'] }
      })
      console.log('✅ ADMIN role added')
    } else {
      console.log('✅ User already has ADMIN role')
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

addAdminRole()
