import { emailService } from '../src/lib/email'

interface PreviewJob {
  type: 'welcome' | 'verify' | 'reset' | 'security' | 'twofactor'
  description: string
  execute: () => Promise<boolean>
}

function getArg(index: number): string | undefined {
  return process.argv[index]
}

async function run() {
  const targetEmail = getArg(2) || process.env.PREVIEW_EMAIL || 'preview@animesenpai.app'
  const fallbackName = targetEmail.split('@')[0] || 'AnimeFan'
  const previewName = getArg(3) || process.env.PREVIEW_NAME || fallbackName

  console.log('📬 Sending AnimeSenpai email previews')
  console.log(`   → To: ${targetEmail}`)
  console.log(`   → Name: ${previewName}`)
  console.log('')

  const jobs: PreviewJob[] = [
    {
      type: 'welcome',
      description: 'Welcome email',
      execute: () => emailService.sendWelcomeEmail(targetEmail, previewName),
    },
    {
      type: 'verify',
      description: 'Email verification (token: preview-token)',
      execute: () => emailService.sendEmailVerification(targetEmail, 'preview-token', previewName),
    },
    {
      type: 'reset',
      description: 'Password reset (token: preview-token)',
      execute: () => emailService.sendPasswordReset(targetEmail, 'preview-token', previewName),
    },
    {
      type: 'security',
      description: 'Security alert (new device sign-in)',
      execute: () => emailService.sendSecurityAlert(targetEmail, 'New sign-in from MacBook Pro (San Francisco, CA)', previewName),
    },
    {
      type: 'twofactor',
      description: 'Two-factor code (code: 981256)',
      execute: () => emailService.sendTwoFactorCode(targetEmail, '981256', previewName),
    },
  ]

  const results = [] as Array<{ type: PreviewJob['type']; success: boolean }>

  for (const job of jobs) {
    process.stdout.write(`• ${job.description} … `)
    try {
      const success = await job.execute()
      results.push({ type: job.type, success })

      if (success) {
        process.stdout.write('sent ✅\n')
      } else {
        process.stdout.write('failed ❌\n')
      }
    } catch (error) {
      results.push({ type: job.type, success: false })
      process.stdout.write('errored ❌\n')
      console.error(`   ↳ Error while sending ${job.type} preview:`, error)
    }
  }

  const failures = results.filter(result => !result.success)

  console.log('\nSummary:')
  results.forEach(result => {
    const status = result.success ? '✅' : '❌'
    console.log(`   ${status} ${result.type}`)
  })

  if (failures.length === 0) {
    console.log('\nAll preview emails sent successfully. ✨')
    process.exit(0)
  } else {
    console.log(`\n${failures.length} preview(s) failed. Check logs above for details.`)
    process.exit(1)
  }
}

run().catch(error => {
  console.error('Unexpected error while sending preview emails:', error)
  process.exit(1)
})
