import bcrypt from "bcryptjs"

const hashInDb = "$2b$12$JU87wz0sqMMiw69NvBMikO9VjaEnxLHrHCmR1pEuqNSWAqTaCtYvW"
const password = "admin123"

async function test() {
    const result = await bcrypt.compare(password, hashInDb)
    console.log(`Password matches hash: ${result}`)

    const newHash = await bcrypt.hash(password, 12)
    console.log(`New hash for '${password}': ${newHash}`)
    const result2 = await bcrypt.compare(password, newHash)
    console.log(`Password matches new hash: ${result2}`)
}

test()
