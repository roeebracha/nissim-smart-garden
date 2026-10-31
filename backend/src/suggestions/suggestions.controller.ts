// HTTP surface for pending suggestions (decision #18 step 2).
// GET /suggestions?status=pending
// POST /suggestions/:id/approve — empty body; the POST itself is the approval.
import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Suggestion } from '../../generated/prisma/client';
import { SuggestionsService } from './suggestions.service';

@Controller('suggestions')
export class SuggestionsController {
  constructor(private readonly suggestions: SuggestionsService) {}

  // Only the pending list is part of the shared contract. Other status
  // filters are not this API.
  @Get()
  listPending(@Query('status') status?: string): Promise<Suggestion[]> {
    if (status !== 'pending') {
      throw new BadRequestException('status must be pending');
    }
    return this.suggestions.listPending();
  }

  // 200, not Nest's default 201: this transitions an existing suggestion.
  // Creating a missing rule is a side effect of that transition.
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  approve(@Param('id', ParseIntPipe) id: number): Promise<Suggestion> {
    return this.suggestions.approve(id);
  }
}
