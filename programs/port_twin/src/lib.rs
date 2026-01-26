use anchor_lang::prelude::*;

declare_id!("6GPNcQ86do8NEFadjgLegNUq8RpwetKK1yqancytPo7H"); // ★後でID書き換える場所

#[program]
pub mod port_twin {
    use super::*;

    // 1. コンテナ登録
    pub fn register_container(
        ctx: Context<RegisterContainer>, 
        container_id: String, 
        voyage_no: String,
        bl_number: String
    ) -> Result<()> {
        let container_account = &mut ctx.accounts.container_account;
        container_account.container_id = container_id;
        // ここは signer のままでOK
        container_account.current_owner = ctx.accounts.signer.key(); 
        container_account.status = "GATE-IN".to_string();
        container_account.voyage_no = voyage_no;
        container_account.bl_number = bl_number;
        msg!("Container Registered!");
        Ok(())
    }

    // 2. ステータス更新
    pub fn update_status(
        ctx: Context<UpdateStatus>, 
        new_status: String
    ) -> Result<()> {
        let container_account = &mut ctx.accounts.container_account;
        container_account.status = new_status;
        msg!("Status Updated to {}", container_account.status);
        Ok(())
    }

    // 3. 所有権移転
    pub fn transfer_ownership(
        ctx: Context<TransferOwnership>, 
        new_owner: Pubkey
    ) -> Result<()> {
        let container_account = &mut ctx.accounts.container_account;
        container_account.current_owner = new_owner;
        msg!("Ownership Transferred!");
        Ok(())
    }
}

// === データ構造 ===
#[account]
pub struct ContainerState {
    pub container_id: String,
    pub current_owner: Pubkey,
    pub status: String,
    pub voyage_no: String,
    pub bl_number: String,
}

// === 権限設定（ここを修正した！） ===

// ↓↓↓ ここを書き換えるんや！ ↓↓↓

#[derive(Accounts)]
#[instruction(container_id: String)] // ★これ追加：引数のIDを使うため
pub struct RegisterContainer<'info> {
    #[account(
        init,
        payer = signer,
        space = 8 + 256,
        seeds = [b"container", container_id.as_bytes()], // ★これ追加：合言葉で住所を決める
        bump // ★これ追加：PDAの安全装置
    )] 
    pub container_account: Account<'info, ContainerState>,
    
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// ↑↑↑ ここまで ↑↑↑

#[derive(Accounts)]
pub struct UpdateStatus<'info> {
    // has_one = current_owner なので、下の署名者も current_owner という名前に統一！
    #[account(mut, has_one = current_owner)] 
    pub container_account: Account<'info, ContainerState>,
    pub current_owner: Signer<'info>, // ← ここを signer から current_owner に変更
}

#[derive(Accounts)]
pub struct TransferOwnership<'info> {
    // ここも同じく名前統一！
    #[account(mut, has_one = current_owner)] 
    pub container_account: Account<'info, ContainerState>,
    pub current_owner: Signer<'info>, // ← ここを signer から current_owner に変更
}