use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, transfer_checked, TransferChecked, TokenInterface}
};

declare_id!("6RNWX7FVHCbiw7ivee5amUt4CzsCGkoj5T2QZdVWWYkh");

#[program]
pub mod awe {
    use super::*;

    pub fn init_awe_metadata(ctx: Context<InitAweMetadata>, agent_price: u64) -> Result<()> {
        msg!("Create new Awe metadata");
        let awe_metadata = &mut ctx.accounts.awe_metadata_account;
        awe_metadata.awe_mint_account = ctx.accounts.awe_mint_account.key();
        awe_metadata.awe_collector_account = ctx.accounts.awe_collector_account.key();
        awe_metadata.agent_price = agent_price;
        Ok(())
    }

    pub fn update_awe_metadata(ctx: Context<UpdateAweMetadata>, agent_price: u64) -> Result<()> {
        msg!("Update Awe metadata");
        let awe_metadata = &mut ctx.accounts.awe_metadata_account;
        awe_metadata.awe_mint_account = ctx.accounts.awe_mint_account.key();
        awe_metadata.awe_collector_account = ctx.accounts.awe_collector_account.key();
        awe_metadata.agent_price = agent_price;
        Ok(())
    }

    pub fn init_agent_creator(ctx: Context<InitAgentCreator>) -> Result<()> {
        msg!("Create a new agent creator account");

        let signer_seeds: &[&[&[u8]]] = &[&[b"delegate", &[ctx.bumps.delegate]]];

        // Transfer AWE before creating the account
        // transfer from sender to delegate token account using delegate PDA
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.awe_sender_account.to_account_info(),
                    mint: ctx.accounts.awe_mint_account.to_account_info(),
                    to: ctx.accounts.awe_collector_account.to_account_info(),
                    authority: ctx.accounts.delegate.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
            ctx.accounts.awe_metadata_account.agent_price,
            ctx.accounts.awe_mint_account.decimals,
        )?;

        let agent_creator = &mut ctx.accounts.agent_creator;

        agent_creator.num_agents = 1;
        Ok(())
    }

    pub fn create_agent(ctx: Context<CreateAgent>) -> Result<()> {
        msg!("Creating a new agent for {}", ctx.accounts.user.key);
        let signer_seeds: &[&[&[u8]]] = &[&[b"delegate", &[ctx.bumps.delegate]]];

        // Transfer AWE before creating the agent
        // transfer from sender to delegate token account using delegate PDA
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.awe_sender_account.to_account_info(),
                    mint: ctx.accounts.awe_mint_account.to_account_info(),
                    to: ctx.accounts.awe_collector_account.to_account_info(),
                    authority: ctx.accounts.delegate.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
            ctx.accounts.awe_metadata_account.agent_price,
            ctx.accounts.awe_mint_account.decimals,
        )?;

        let agent_creator = &mut ctx.accounts.agent_creator;

        agent_creator.num_agents += 1;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitAweMetadata<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    pub awe_mint_account: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        seeds = [b"awe_metadata", user.key().as_ref()],
        bump,
        payer = user,
        space = 8 + AweMetadata::INIT_SPACE
    )]
    pub awe_metadata_account: Account<'info, AweMetadata>,

    #[account(
        token::mint = awe_mint_account,
    )]
    pub awe_collector_account: InterfaceAccount<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAweMetadata<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    pub awe_mint_account: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [b"awe_metadata", user.key().as_ref()],
        bump,
    )]
    pub awe_metadata_account: Account<'info, AweMetadata>,

    #[account(
        token::mint = awe_mint_account,
    )]
    pub awe_collector_account: InterfaceAccount<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitAgentCreator<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        has_one=awe_mint_account,
        has_one=awe_collector_account
    )]
    pub awe_metadata_account: Account<'info, AweMetadata>,
    pub awe_mint_account: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        token::mint = awe_mint_account,
    )]
    pub awe_collector_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        seeds = [b"agent_creator", awe_metadata_account.key().as_ref(), user.key().as_ref()],
        bump,
        payer = user,
        space = 8 + AgentCreator::INIT_SPACE
    )]
    pub agent_creator: Account<'info, AgentCreator>,

    #[account(
        mut,
        token::mint = awe_mint_account,
    )]
    pub awe_sender_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        seeds = [b"delegate"],
        bump
    )]
    pub delegate: SystemAccount<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateAgent<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        has_one=awe_mint_account,
        has_one=awe_collector_account
    )]
    pub awe_metadata_account: Account<'info, AweMetadata>,
    pub awe_mint_account: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        token::mint = awe_mint_account,
    )]
    pub awe_collector_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"agent_creator", awe_metadata_account.key().as_ref(), user.key().as_ref()],
        bump,
    )]
    pub agent_creator: Account<'info, AgentCreator>,

    #[account(
        mut,
        token::mint = awe_mint_account,
    )]
    pub awe_sender_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        seeds = [b"delegate"],
        bump
    )]
    pub delegate: SystemAccount<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct AweMetadata {
    pub awe_mint_account: Pubkey,
    pub awe_collector_account: Pubkey,
    pub agent_price: u64,
}

#[account]
#[derive(InitSpace)]
pub struct AgentCreator {
    pub num_agents: u8,
}
