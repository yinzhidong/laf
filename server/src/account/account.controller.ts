import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from 'src/auth/jwt.auth.guard'
import { IRequest, IResponse } from 'src/utils/interface'
import { ApiResponseObject, ResponseUtil } from 'src/utils/response'
import { AccountService } from './account.service'
import {
  CreateChargeOrderDto,
  CreateChargeOrderOutDto,
} from './dto/create-charge-order.dto'
import { PaymentChannelService } from './payment/payment-channel.service'
import {
  WeChatPayChargeOrder,
  WeChatPayOrderResponse,
  WeChatPayTradeState,
} from './payment/types'
import { WeChatPayService } from './payment/wechat-pay.service'
import * as assert from 'assert'
import { ServerConfig } from 'src/constants'
import {
  AccountChargeOrder,
  AccountChargePhase,
} from './entities/account-charge-order'
import { ObjectId } from 'mongodb'
import { SystemDatabase } from 'src/system-database'
import { Account } from './entities/account'
import { AccountTransaction } from './entities/account-transaction'

@ApiTags('Account')
@Controller('accounts')
@ApiBearerAuth('Authorization')
export class AccountController {
  private readonly logger = new Logger(AccountController.name)

  constructor(
    private readonly accountService: AccountService,
    private readonly paymentService: PaymentChannelService,
    private readonly wechatPayService: WeChatPayService,
  ) {}

  /**
   * Get account info
   */
  @ApiOperation({ summary: 'Get account info' })
  @ApiResponseObject(Account)
  @UseGuards(JwtAuthGuard)
  @Get()
  async findOne(@Req() req: IRequest) {
    const user = req.user
    const data = await this.accountService.findOne(user._id)
    data.balance = Math.floor(data.balance)
    return ResponseUtil.ok(data)
  }

  /**
   * Get charge order
   */
  @ApiOperation({ summary: 'Get charge order' })
  @ApiResponseObject(AccountChargeOrder)
  @UseGuards(JwtAuthGuard)
  @Get('charge-order/:id')
  async getChargeOrder(@Req() req: IRequest, @Param('id') id: string) {
    const user = req.user
    const data = await this.accountService.findOneChargeOrder(
      user._id,
      new ObjectId(id),
    )
    return ResponseUtil.ok(data)
  }

  /**
   * Create charge order
   */
  @ApiOperation({ summary: 'Create charge order' })
  @ApiResponseObject(CreateChargeOrderOutDto)
  @UseGuards(JwtAuthGuard)
  @Post('charge-order')
  async charge(@Req() req: IRequest, @Body() dto: CreateChargeOrderDto) {
    const user = req.user
    const { amount, currency, channel } = dto

    // create charge order
    const order = await this.accountService.createChargeOrder(
      user._id,
      amount,
      currency,
      channel,
    )

    // invoke payment
    const result = await this.accountService.pay(
      channel,
      order._id,
      amount,
      currency,
      `${ServerConfig.SITE_NAME} recharge`,
    )

    return ResponseUtil.ok({
      order,
      result,
    })
  }

  /**
   * WeChat payment notify
   */
  @Post('payment/wechat-notify')
  async wechatNotify(@Req() req: IRequest, @Res() res: IResponse) {
    try {
      // get headers
      const headers = req.headers
      const nonce = headers['wechatpay-nonce'] as string
      const timestamp = headers['wechatpay-timestamp'] as string
      const signature = headers['wechatpay-signature'] as string
      const serial = headers['wechatpay-serial'] as string

      // get body
      const body = req.body as WeChatPayOrderResponse

      const spec = await this.paymentService.getWeChatPaySpec()
      const result = await this.wechatPayService.getWeChatPayNotifyResult(
        spec,
        {
          timestamp,
          nonce,
          body,
          serial,
          signature,
        },
      )

      this.logger.debug(result)

      const db = SystemDatabase.db

      const tradeOrderId = new ObjectId(result.out_trade_no)
      if (result.trade_state !== WeChatPayTradeState.SUCCESS) {
        await db
          .collection<WeChatPayChargeOrder>('AccountChargeOrder')
          .updateOne(
            { _id: tradeOrderId },
            { $set: { phase: AccountChargePhase.Failed, result: result } },
          )

        this.logger.log(
          `wechatpay order failed: ${tradeOrderId} ${result.trade_state}`,
        )
        return res.status(200).send()
      }

      // start transaction
      const client = SystemDatabase.client
      const session = client.startSession()
      await session.withTransaction(async () => {
        // update order to success
        const res = await db
          .collection<WeChatPayChargeOrder>('AccountChargeOrder')
          .findOneAndUpdate(
            { _id: tradeOrderId, phase: AccountChargePhase.Pending },
            { $set: { phase: AccountChargePhase.Paid, result: result } },
            { session, returnDocument: 'after' },
          )

        const order = res.value
        if (!order) {
          this.logger.error(`wechatpay order not found: ${tradeOrderId}`)
          return
        }

        // get & update account balance
        const ret = await db
          .collection<Account>('Account')
          .findOneAndUpdate(
            { _id: order.accountId },
            { $inc: { balance: order.amount } },
            { session, returnDocument: 'after' },
          )

        assert(ret.value, `account not found: ${order.accountId}`)

        // create transaction
        await db.collection<AccountTransaction>('AccountTransaction').insertOne(
          {
            accountId: order.accountId,
            amount: order.amount,
            balance: ret.value.balance,
            message: 'Recharge by WeChat Pay',
            orderId: order._id,
            createdAt: new Date(),
          },
          { session },
        )

        this.logger.log(`wechatpay order success: ${tradeOrderId}`)
      })
    } catch (err) {
      this.logger.error(err)
      return res.status(400).send({ code: 'FAIL', message: 'ERROR' })
    }

    return res.status(200).send()
  }
}
